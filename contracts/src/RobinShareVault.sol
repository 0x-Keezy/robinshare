// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ECDSA} from "openzeppelin-contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "openzeppelin-contracts/utils/cryptography/EIP712.sol";
import {Strings} from "openzeppelin-contracts/utils/Strings.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/token/ERC20/utils/SafeERC20.sol";
import {IXGeneralVerifier} from "./flap/IXGeneralVerifier.sol";
import {IV2FeeEscrow, IPonsV2Curve, IPonsV2LaunchFactory} from "./pons/IPonsV2.sol";

interface IAttesterSource {
    function attester() external view returns (address);
}

/// @title RobinShareVault — social fee escrow sobre pons v2 (Robinhood Chain)
/// @notice Acumula las creator fees de un launch de pons a nombre de UNA identidad (GitHub, X o
///         wallet) que puede no tener wallet todavia. Quien prueba la identidad cobra.
///
/// @dev PORT desde el rail de Flap. Tres diferencias estructurales, todas medidas contra la
///      cadena y documentadas en docs/superpowers/specs/2026-08-29-robinshare-pons-port-design.md:
///
///      1. EL DINERO NO LLEGA SOLO. En Flap el tax llegaba por push y `address(this).balance` era
///         la contabilidad. En pons las fees se acumulan en la CURVA y, al barrer, se ACREDITAN en
///         un ledger externo (V2FeeEscrow) bajo la clave de este vault. Hacen falta dos pasos:
///         `sweepCurve()` (la curva -> el escrow) y `pull()` (el escrow -> aca). Los dos son
///         permissionless y estan compuestos en `harvest()`.
///
///      2. NO HAY GUARDIAN. Se elimino el escape hatch de Flap. El unico caso real de fondos
///         trabados (un boundWallet que no puede recibir ETH) se cierra con payout PULL:
///         `withdraw()`. El push de los claims es best-effort y NO revierte si falla.
///
///      3. NO HAY `taxToken` INMUTABLE. En pons la direccion del token depende de la de este vault
///         (su creation code incluye el creatorFeeRecipient), asi que no se puede predecir. El link
///         se establece despues con `attachToken()`, que lo VERIFICA contra el factory de pons.
contract RobinShareVault is EIP712, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint8 public constant TYPE_WALLET = 0;
    uint8 public constant TYPE_GITHUB = 1;
    uint8 public constant TYPE_TWITTER = 2;

    bytes32 public constant BIND_TYPEHASH =
        keccak256("Bind(address payoutWallet,uint256 nonce,uint256 deadline)");

    // ───────────────────────── inmutables ─────────────────────────

    /// @notice Quien lanzo la moneda y pago el launch fee. NO es el beneficiario.
    /// @dev En el contrato de Flap esto se llamaba `creator`, lo que en un producto sobre pagarle
    ///      a creators es una trampa: llevo a proponer un clawback obligatorio hacia el lanzador,
    ///      justo el ataque que este producto existe para impedir.
    address public immutable launcher;
    uint8 public immutable identityType;
    /// @notice Fuente VIVA del attester (la factory) — ruta GITHUB, rotable.
    address public immutable attesterSource;
    /// @notice XGeneralVerifier oficial de Flap — ruta TWITTER. Es un oraculo agnostico del
    ///         launchpad (medido en vivo: firma substrings arbitrarios, sin registro de vaults).
    address public immutable xVerifier;
    /// @notice La wallet-identidad original (solo TYPE_WALLET; 0x0 para github/twitter).
    address public immutable identityWallet;
    /// @notice 0 = NUNCA. Es el default del producto: la plata espera indefinidamente a su dueno.
    uint64 public immutable recoveryAfter;

    IV2FeeEscrow public immutable feeEscrow;
    IPonsV2LaunchFactory public immutable ponsFactory;

    string public identityValue; // normalizada por la factory; vacia para TYPE_WALLET

    // ───────────────────────── estado ─────────────────────────

    /// @notice El token del launch, y su curva. Se atan DESPUES del launch con `attachToken()`.
    address public token;
    address public curve;

    address public boundWallet; // 0x0 hasta probar identidad; TYPE_WALLET la fija el constructor
    uint256 public bindNonce;
    uint256 public totalPaid;
    /// @notice Replay guard GLOBAL de la ruta X: un tweet mas nuevo invalida a TODOS los anteriores.
    uint128 public lastTweetId;

    event Bound(address indexed payoutWallet, uint256 nonce);
    event Swept(address indexed to, uint256 amount);
    event SweptToken(address indexed to, address indexed erc20, uint256 amount);
    event Recovered(address indexed to, uint256 amount);
    event TokenAttached(address indexed token, address indexed curve);
    event Harvested(uint256 amount);
    /// @notice El push del claim fallo; la plata quedo aca y `withdraw()` la saca. No es un error.
    event PayoutDeferred(address indexed to, uint256 amount);

    error BadIdentityType();
    error WalletRequired();
    error AttesterRequired();
    error ZeroPayout();
    error TokenAlreadyAttached();
    error NotOurLaunch();
    error NotBoundWallet();
    error NotBoundYet();
    error NothingToSweep();
    error OnlyLauncher();
    error RecoveryDisabled();
    error AlreadyBound();
    error TooEarly();
    error GithubOnly();
    error TwitterOnly();
    error WalletOnly();
    error NotIdentityWallet();
    error VoucherExpired();
    error BadAttesterSignature();
    error XVerifierMissing();
    error SubstringMismatch();
    error WrongXHandle();
    error InvalidProof();
    error OutdatedProof();

    constructor(
        address launcher_,
        uint8 identityType_,
        string memory identityValue_,
        address identityWallet_,
        address attesterSource_,
        address xVerifier_,
        uint64 recoveryAfter_,
        address feeEscrow_,
        address ponsFactory_
    ) EIP712("SocialFeeEscrow", "1") {
        if (identityType_ > TYPE_TWITTER) revert BadIdentityType();
        launcher = launcher_;
        identityType = identityType_;
        identityValue = identityValue_;
        attesterSource = attesterSource_;
        xVerifier = xVerifier_;
        recoveryAfter = recoveryAfter_;
        feeEscrow = IV2FeeEscrow(feeEscrow_);
        ponsFactory = IPonsV2LaunchFactory(ponsFactory_);
        identityWallet = identityType_ == TYPE_WALLET ? identityWallet_ : address(0);

        if (identityType_ == TYPE_WALLET) {
            if (identityWallet_ == address(0)) revert WalletRequired();
            boundWallet = identityWallet_;
            emit Bound(identityWallet_, 0);
        } else if (identityType_ == TYPE_GITHUB) {
            if (attesterSource_ == address(0)) revert AttesterRequired();
            // sanity al deploy: la fuente debe resolver a un attester real (caza EOAs/basura)
            if (IAttesterSource(attesterSource_).attester() == address(0)) revert AttesterRequired();
        }
    }

    /// @notice Recibe el ETH que paga el FeeEscrow de pons en `claim()`.
    /// @dev INFALIBLE a proposito: sin logica, no puede revertir. El escrow paga con `.call`
    ///      reenviando todo el gas y convierte cualquier fallo en `TransferFailed()`, lo que
    ///      dejaria el credito trabado del lado de pons.
    receive() external payable {}

    // ───────────────────────── link con el launch de pons ─────────────────────────

    /// @notice Ata este vault a su token. Permissionless y AUTO-VERIFICABLE: solo acepta si el
    ///         factory de pons dice que este vault es el `creatorFeeRecipient` de ese launch.
    /// @dev No es un parametro del constructor porque la direccion del token depende de la de este
    ///      vault (la creation code de la curva incluye el creatorFeeRecipient), asi que no se
    ///      puede predecir. Nadie tiene que confiar en quien llama: la verdad la da la cadena.
    function attachToken(address token_) external {
        if (token != address(0)) revert TokenAlreadyAttached();
        IPonsV2LaunchFactory.LaunchedToken memory info = ponsFactory.getLaunchedToken(token_);
        if (!info.exists || info.creatorFeeRecipient != address(this)) revert NotOurLaunch();
        token = token_;
        curve = info.curve;
        emit TokenAttached(token_, info.curve);
    }

    // ───────────────────────── cobro (dos pasos, permissionless) ─────────────────────────

    /// @notice Empuja las fees acumuladas en la curva hacia el FeeEscrow de pons.
    /// @dev NO es opcional: se midio que el operador de pons no barre a tiempo en fase de curva
    ///      (en 404 s tradearon 118 curvas y solo se barrieron 15). Tolera el revert a proposito:
    ///      post-graduacion `AlreadyGraduated()`, y en el hook `InternalSwapRequiresOperator()`
    ///      cuando hay fees denominadas en el memecoin — casos normales, no errores.
    function sweepCurve() public {
        address c = curve;
        if (c == address(0)) return;
        try IPonsV2Curve(c).sweepFees(0) {} catch {}
    }

    /// @notice Trae al vault lo que el FeeEscrow de pons tenga acreditado a su nombre.
    /// @dev El `claim()` de pons es msg.sender-only, asi que esto SOLO lo puede hacer el vault.
    ///      Se consulta el saldo antes: `claim()` con saldo cero revierte `NoBalance()`, lo que
    ///      convertiria un no-op en un griefing repetible contra las rutas de claim.
    function pull() public returns (uint256 amount) {
        if (feeEscrow.balanceOf(address(this)) == 0) return 0;
        amount = feeEscrow.claim();
        emit Harvested(amount);
    }

    /// @notice Los dos pasos juntos. Permissionless: cualquiera puede pagar el gas.
    function harvest() public returns (uint256) {
        sweepCurve();
        return pull();
    }

    /// @notice Lo que hay para cobrar: lo que ya esta aca mas lo acreditado en el escrow de pons.
    /// @dev NO incluye lo que siga sin barrer en la curva — eso lo mueve `sweepCurve()`.
    function pendingAmount() public view returns (uint256) {
        return address(this).balance + feeEscrow.balanceOf(address(this));
    }

    // ───────────────────────── payout ─────────────────────────

    /// @notice El beneficiario retira. PULL: el vault no decide cuando ni como se entrega.
    /// @dev Reemplaza al `sweep()` push del rail de Flap. Es lo que permite borrar el Guardian:
    ///      si la wallet no puede recibir en una llamada push, simplemente no llama — y la
    ///      identidad puede rotarla antes con las rutas de claim o `rebindWallet`.
    function withdraw() external nonReentrant {
        address to = boundWallet;
        if (to == address(0)) revert NotBoundYet();
        if (msg.sender != to) revert NotBoundWallet();
        harvest();
        uint256 amount = address(this).balance;
        if (amount == 0) revert NothingToSweep();
        totalPaid += amount;
        emit Swept(to, amount);
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert("payout failed");
    }

    /// @notice Retira un ERC-20 que haya llegado al vault, SIEMPRE al boundWallet.
    /// @dev No es hipotetico: `rescuePoolFees` del hook de pons (onlyOwner) NO pasa por el escrow,
    ///      hace `safeTransfer` directo al creatorFeeRecipient; y 11 de las 18 curvas mas activas
    ///      cotizan contra ERC-20. Por token y no por lista: un token envenenado que revierta no
    ///      puede bloquear el retiro de los demas.
    function withdrawToken(address erc20) external nonReentrant {
        address to = boundWallet;
        if (to == address(0)) revert NotBoundYet();
        if (msg.sender != to) revert NotBoundWallet();
        // el ledger por-token de pons tambien se cobra con msg.sender-only
        if (feeEscrow.balanceOfToken(address(this), erc20) > 0) {
            feeEscrow.claimToken(erc20);
        }
        uint256 amount = IERC20(erc20).balanceOf(address(this));
        if (amount == 0) revert NothingToSweep();
        emit SweptToken(to, erc20, amount);
        IERC20(erc20).safeTransfer(to, amount);
    }

    /// @dev Push best-effort tras un claim: si el destino no puede recibir, la plata queda aca y
    ///      `withdraw()` la saca. NO revierte — un claim relayado no debe fallar por eso.
    function _tryPayout(address to) private {
        uint256 amount = address(this).balance;
        if (amount == 0) return;
        (bool ok,) = to.call{value: amount}("");
        if (ok) {
            totalPaid += amount;
            emit Swept(to, amount);
        } else {
            emit PayoutDeferred(to, amount);
        }
    }

    // ───────────────────────── identidad ─────────────────────────

    /// @notice El attester VIGENTE (leido en vivo de la factory; rotable).
    function attester() public view returns (address) {
        return identityType == TYPE_GITHUB ? IAttesterSource(attesterSource).attester() : address(0);
    }

    /// @notice Digest EIP-712 que el attester debe firmar para autorizar el bind actual.
    /// @dev El attester server NO usa esto para decidir que firma: lo reconstruye el mismo con el
    ///      dominio scopeado a la direccion pedida. Si lo leyera de aca, un contrato hostil que
    ///      reenvie esta funcion al vault de otro conseguiria una firma valida contra ese vault.
    function bindDigest(address payoutWallet, uint256 deadline) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(BIND_TYPEHASH, payoutWallet, bindNonce, deadline)));
    }

    /// @notice Ruta GITHUB: voucher del attester. Relayable — la firma autoriza el bind, y quien
    ///         manda la transaccion puede ser cualquiera (por eso un dev sin ETH puede cobrar).
    function claimAndBind(address payoutWallet, uint256 deadline, bytes calldata signature)
        external
        nonReentrant
    {
        if (identityType != TYPE_GITHUB) revert GithubOnly();
        if (payoutWallet == address(0)) revert ZeroPayout();
        if (block.timestamp > deadline) revert VoucherExpired();
        address signer = ECDSA.recover(bindDigest(payoutWallet, deadline), signature);
        if (signer != attester()) revert BadAttesterSignature();

        emit Bound(payoutWallet, bindNonce);
        boundWallet = payoutWallet;
        unchecked {
            bindNonce++;
        }

        harvest();
        _tryPayout(payoutWallet);
    }

    /// @notice El handle de X que debe postear el tweet de claim (el fondeado). Lowercase.
    function expectedHandle(address) external view returns (string memory) {
        return identityValue;
    }

    /// @notice El substring EXACTO que el tweet de claim debe contener, unico por wallet + vault.
    function expectedTweet(address beneficiary) public view returns (string memory) {
        return string.concat(
            Strings.toHexString(beneficiary),
            " is claiming the tokens locked in the vault of ",
            Strings.toHexString(address(this))
        );
    }

    /// @notice Ruta TWITTER: prueba firmada por el oraculo de Flap. RELAYABLE.
    /// @param payoutWallet la wallet que queda bindeada y cobra. Va nombrada EN EL TWEET (es parte
    ///        del substring), asi que no hace falta que sea msg.sender.
    /// @dev CAMBIO respecto del rail de Flap, donde se exigia `msg.sender == payout`: eso obligaba
    ///      al beneficiario a tener ETH en la cadena, y rompia la promesa central del producto
    ///      ("un dev que ni siquiera tiene wallet") justo en la ruta mas viral. El substring ata la
    ///      prueba a ESA wallet y a ESTE vault, asi que un relayer no puede desviar nada.
    function claimByProof(
        address payoutWallet,
        IXGeneralVerifier.XGeneralProof calldata proof,
        bytes calldata signature
    ) external nonReentrant {
        if (identityType != TYPE_TWITTER) revert TwitterOnly();
        if (payoutWallet == address(0)) revert ZeroPayout();
        if (xVerifier == address(0)) revert XVerifierMissing();
        // (1) el substring ata la prueba a ESA wallet y a ESTE vault
        if (keccak256(bytes(proof.substring)) != keccak256(bytes(expectedTweet(payoutWallet)))) {
            revert SubstringMismatch();
        }
        // (2) el tweet debe ser del handle FONDEADO
        if (keccak256(bytes(proof.xHandle)) != keccak256(bytes(identityValue))) revert WrongXHandle();
        // (3) firma del oraculo
        if (!IXGeneralVerifier(xVerifier).verify(proof, signature)) revert InvalidProof();
        // (4) replay GLOBAL: un tweet mas nuevo invalida a TODOS los anteriores
        if (proof.tweetId <= lastTweetId) revert OutdatedProof();
        lastTweetId = proof.tweetId;

        emit Bound(payoutWallet, bindNonce);
        boundWallet = payoutWallet;
        unchecked {
            bindNonce++;
        }

        harvest();
        _tryPayout(payoutWallet);
    }

    /// @notice Ruta WALLET: la identidad original puede rotar su wallet de cobro.
    function rebindWallet(address newPayout) external {
        if (identityType != TYPE_WALLET) revert WalletOnly();
        if (msg.sender != identityWallet) revert NotIdentityWallet();
        if (newPayout == address(0)) revert ZeroPayout();
        emit Bound(newPayout, bindNonce);
        boundWallet = newPayout;
        unchecked {
            bindNonce++;
        }
    }

    // ───────────────────────── recovery ─────────────────────────

    /// @notice Si la identidad nunca aparecio Y el launcher fijo un plazo, devuelve el balance.
    /// @dev `recoveryAfter == 0` (el DEFAULT del producto) lo deshabilita para siempre. Hacerlo
    ///      obligatorio le daria al launcher un clawback garantizado: lanzar "para" un dev conocido,
    ///      farmear fees y quedarse con todo si la persona no aparece a tiempo.
    function recoverUnclaimed(address to) external nonReentrant {
        if (msg.sender != launcher) revert OnlyLauncher();
        if (to == address(0)) revert ZeroPayout();
        if (recoveryAfter == 0) revert RecoveryDisabled();
        if (boundWallet != address(0)) revert AlreadyBound();
        if (block.timestamp < recoveryAfter) revert TooEarly();
        harvest();
        uint256 amount = address(this).balance;
        if (amount == 0) revert NothingToSweep();
        totalPaid += amount;
        emit Recovered(to, amount);
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert("payout failed");
    }
}
