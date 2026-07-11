// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ECDSA} from "openzeppelin-contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "openzeppelin-contracts/utils/cryptography/EIP712.sol";
import {Strings} from "openzeppelin-contracts/utils/Strings.sol";
import {VaultBaseV2} from "./flap/VaultBaseV2.sol";
import {VaultUISchema, VaultMethodSchema, FieldDescriptor, ApproveAction} from "./flap/IVaultSchemasV1.sol";
import {IXGeneralVerifier} from "./flap/IXGeneralVerifier.sol";

/// @title SocialFeeEscrow (FLEDGE)
/// @notice Acumula el tax (ETH nativo) de un token de Flap para UNA identidad
///         (wallet / github / twitter) y solo lo entrega a la wallet que la probó.
///         Inmutable. Sin owner, sin pause, sin upgrade, sin funciones privilegiadas.
contract SocialFeeEscrow is VaultBaseV2, EIP712 {
    uint8 public constant TYPE_WALLET = 0;
    uint8 public constant TYPE_GITHUB = 1;
    uint8 public constant TYPE_TWITTER = 2;

    bytes32 public constant BIND_TYPEHASH =
        keccak256("Bind(address payoutWallet,uint256 nonce,uint256 deadline)");

    address public immutable taxToken; // direccion PREDICHA del token; puede no tener codigo aun
    address public immutable creator;
    uint8 public immutable identityType;
    address public immutable attester; // firma vouchers de la ruta GITHUB (EIP-712)
    address public immutable xVerifier; // XGeneralVerifier oficial de Flap, ruta TWITTER
    uint64 public immutable recoveryAfter; // 0 = nunca
    string public identityValue; // normalizada por la factory; vacia para TYPE_WALLET

    address public boundWallet; // 0x0 hasta probar identidad; TYPE_WALLET la fija el constructor
    uint256 public bindNonce;
    uint256 public totalPaid;
    mapping(address => uint128) public lastTweetId; // replay guard de la ruta X (Snowflake crece)

    event Bound(address indexed payoutWallet, uint256 nonce);
    event Swept(address indexed to, uint256 amount);
    event Recovered(address indexed to, uint256 amount);

    constructor(
        address taxToken_,
        address creator_,
        uint8 identityType_,
        string memory identityValue_,
        address identityWallet_,
        address attester_,
        address xVerifier_,
        uint64 recoveryAfter_
    ) EIP712("SocialFeeEscrow", "1") {
        require(identityType_ <= TYPE_TWITTER, unicode"bad identity type / 身份类型无效");
        taxToken = taxToken_;
        creator = creator_;
        identityType = identityType_;
        identityValue = identityValue_;
        attester = attester_;
        xVerifier = xVerifier_;
        recoveryAfter = recoveryAfter_;
        if (identityType_ == TYPE_WALLET) {
            require(identityWallet_ != address(0), unicode"wallet required / 需要钱包地址");
            boundWallet = identityWallet_;
            emit Bound(identityWallet_, 0);
        } else if (identityType_ == TYPE_GITHUB) {
            require(attester_ != address(0), unicode"attester required / 需要认证者地址");
        }
        // TYPE_TWITTER: usa el XGeneralVerifier de Flap (chain-based, via factory). Si aun no esta
        // desplegado en esta chain, xVerifier_ = 0 y claimByProof revierte hasta que exista.
    }

    /// @notice Recibe el tax del TaxProcessor de Flap.
    /// @dev CUERPO VACIO — invariante dura. Sin SSTORE, sin eventos, sin require:
    ///      si esto revierte (p.ej. con stipend de 2300 gas), esa porcion del tax
    ///      va al fee receiver de Flap PARA SIEMPRE, sin retry.
    receive() external payable {}

    function pendingAmount() public view returns (uint256) {
        return address(this).balance;
    }

    /// @notice Digest EIP-712 que el attester debe firmar para autorizar el bind actual.
    /// @dev Usa el bindNonce VIGENTE: el attester lo lee de aca via eth_call y firma
    ///      exactamente este hash — cero re-implementacion del typed-data off-chain.
    function bindDigest(address payoutWallet, uint256 deadline) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(BIND_TYPEHASH, payoutWallet, bindNonce, deadline)));
    }

    /// @notice Ruta GITHUB: prueba la identidad (voucher del attester) y cobra todo el balance.
    ///         Re-llamable con voucher fresco para re-bind (rotar wallet de cobro).
    ///         Twitter usa claimByProof; wallet usa sweep.
    function claimAndBind(address payoutWallet, uint256 deadline, bytes calldata signature) external {
        require(identityType == TYPE_GITHUB, unicode"github identity only / 仅限 github 身份");
        require(payoutWallet != address(0), unicode"zero payout / 收款地址为空");
        require(block.timestamp <= deadline, unicode"voucher expired / 凭证已过期");
        address signer = ECDSA.recover(bindDigest(payoutWallet, deadline), signature);
        require(signer == attester, unicode"bad attester signature / 认证签名无效");

        emit Bound(payoutWallet, bindNonce);
        boundWallet = payoutWallet;
        unchecked {
            bindNonce++;
        }

        uint256 amount = address(this).balance;
        if (amount > 0) {
            totalPaid += amount; // efectos antes de la interaccion (CEI)
            emit Swept(payoutWallet, amount);
            (bool ok,) = payoutWallet.call{value: amount}("");
            require(ok, unicode"payout failed / 支付失败");
        }
    }

    // ───────────────────────── Ruta TWITTER/X: XGeneralVerifier oficial de Flap ─────────────────────────

    /// @notice El handle de X que debe postear el tweet de claim (el fondeado). Lowercase.
    /// @dev Fijo por vault (no depende del beneficiary). Lo lee el dApp al conectar.
    function expectedHandle(address) external view returns (string memory) {
        return identityValue;
    }

    /// @notice El substring EXACTO que el tweet de claim debe contener, único por wallet + vault.
    /// @dev Patrón del Gift Vault de Flap: address del claimer + el vault (esta address) como tag
    ///      único. Addresses en hex lowercase (Strings.toHexString). Match case-sensitive.
    function expectedTweet(address beneficiary) public view returns (string memory) {
        return string.concat(
            Strings.toHexString(beneficiary),
            " is claiming the tokens locked in the vault of ",
            Strings.toHexString(address(this))
        );
    }

    /// @notice Ruta TWITTER: prueba firmada por el oráculo de Flap (XGeneralVerifier) y cobra.
    ///         El claimer (msg.sender) es la wallet que recibe. Re-llamable con un tweet nuevo
    ///         (tweetId mayor) para re-bind a otra wallet.
    function claimByProof(IXGeneralVerifier.XGeneralProof calldata proof, bytes calldata signature) external {
        require(identityType == TYPE_TWITTER, unicode"twitter identity only / 仅限 twitter 身份");
        require(xVerifier != address(0), unicode"x verifier not on this chain yet / 本链暂无 X 验证器");
        // (1) substring ata la prueba a ESTA wallet (msg.sender) y a ESTE vault.
        require(
            keccak256(bytes(proof.substring)) == keccak256(bytes(expectedTweet(msg.sender))),
            unicode"substring mismatch / substring 不匹配"
        );
        // (2) el tweet debe ser del handle FONDEADO (el verifier devuelve el handle real, lowercase).
        //     Sin este check, cualquier cuenta que postee el substring podría reclamar.
        require(
            keccak256(bytes(proof.xHandle)) == keccak256(bytes(identityValue)),
            unicode"wrong x handle / X 账号不符"
        );
        // (3) firma del oráculo de Flap.
        require(IXGeneralVerifier(xVerifier).verify(proof, signature), unicode"invalid proof / 证明无效");
        // (4) replay: los Snowflake IDs crecen; exigimos estrictamente mayor por claimer.
        require(proof.tweetId > lastTweetId[msg.sender], unicode"outdated proof / 证明已过期");
        lastTweetId[msg.sender] = proof.tweetId;

        emit Bound(msg.sender, bindNonce);
        boundWallet = msg.sender;
        unchecked {
            bindNonce++;
        }
        uint256 amount = address(this).balance;
        if (amount > 0) {
            totalPaid += amount;
            emit Swept(msg.sender, amount);
            (bool ok,) = msg.sender.call{value: amount}("");
            require(ok, unicode"payout failed / 支付失败");
        }
    }

    /// @notice Envia todo el balance a la wallet ya probada. Permissionless a proposito:
    ///         cualquiera puede pagar el gas para empujar los fees a su dueno.
    function sweep() external {
        require(boundWallet != address(0), unicode"not bound yet / 尚未绑定");
        uint256 amount = address(this).balance;
        require(amount > 0, unicode"nothing to sweep / 无可领取余额");
        totalPaid += amount;
        emit Swept(boundWallet, amount);
        (bool ok,) = boundWallet.call{value: amount}("");
        require(ok, unicode"payout failed / 支付失败");
    }

    /// @notice Si la persona nunca aparecio y el creator fijo un plazo al launch,
    ///         devuelve el balance al creator. Nunca disponible despues de un bind.
    function recoverUnclaimed() external {
        require(recoveryAfter != 0, unicode"recovery disabled / 回收未启用");
        require(boundWallet == address(0), unicode"already bound / 已绑定");
        require(block.timestamp >= recoveryAfter, unicode"too early / 未到回收时间");
        uint256 amount = address(this).balance;
        require(amount > 0, unicode"nothing to recover / 无可回收余额");
        totalPaid += amount;
        emit Recovered(creator, amount);
        (bool ok,) = creator.call{value: amount}("");
        require(ok, unicode"payout failed / 支付失败");
    }

    function description() public view override returns (string memory) {
        string memory id = identityType == TYPE_WALLET
            ? Strings.toHexString(boundWallet)
            : string.concat(identityType == TYPE_GITHUB ? "github:" : "x:", identityValue);
        string memory state;
        if (boundWallet != address(0)) {
            state = string.concat("bound to ", Strings.toHexString(boundWallet));
        } else if (recoveryAfter != 0 && block.timestamp >= recoveryAfter) {
            state = "unclaimed (recoverable by creator)";
        } else {
            state = "waiting for its person";
        }
        return string.concat(
            "FLEDGE fee escrow for ",
            id,
            ": ",
            _fmtEth(address(this).balance),
            " ETH pending, ",
            _fmtEth(totalPaid),
            " ETH paid out. Status: ",
            state,
            "."
        );
    }

    function _fmtEth(uint256 weiAmount) internal pure returns (string memory) {
        uint256 milli = weiAmount / 1e15; // resolucion 0.001 ETH
        string memory frac = Strings.toString(milli % 1000);
        if (milli % 1000 < 10) frac = string.concat("00", frac);
        else if (milli % 1000 < 100) frac = string.concat("0", frac);
        return string.concat(Strings.toString(milli / 1000), ".", frac);
    }

    function vaultUISchema() public pure override returns (VaultUISchema memory schema) {
        schema.vaultType = "SocialFeeEscrow";
        schema.description =
            "Trading-fee escrow for one identity (wallet, GitHub or X). Funds can only ever go to the wallet that proved the identity.";
        schema.methods = new VaultMethodSchema[](4);

        FieldDescriptor[] memory claimIn = new FieldDescriptor[](3);
        claimIn[0] = FieldDescriptor("payoutWallet", "address", "Wallet that will receive the fees", 0);
        claimIn[1] = FieldDescriptor("deadline", "time", "Voucher expiry (unix seconds)", 0);
        claimIn[2] = FieldDescriptor("signature", "bytes", "Attester voucher signature", 0);
        schema.methods[0] = VaultMethodSchema(
            "claimAndBind",
            "Prove the identity with an attester voucher, bind the payout wallet and claim all pending ETH.",
            claimIn,
            new FieldDescriptor[](0),
            new ApproveAction[](0),
            false,
            false,
            true
        );

        schema.methods[1] = VaultMethodSchema(
            "sweep",
            "Push all pending ETH to the already-bound wallet. Anyone may pay the gas.",
            new FieldDescriptor[](0),
            new FieldDescriptor[](0),
            new ApproveAction[](0),
            false,
            false,
            true
        );

        FieldDescriptor[] memory pendingOut = new FieldDescriptor[](1);
        pendingOut[0] = FieldDescriptor("pending", "uint256", "ETH currently claimable", 18);
        schema.methods[2] = VaultMethodSchema(
            "pendingAmount",
            "ETH accumulated and not yet paid out.",
            new FieldDescriptor[](0),
            pendingOut,
            new ApproveAction[](0),
            false,
            false,
            false
        );

        FieldDescriptor[] memory boundOut = new FieldDescriptor[](1);
        boundOut[0] = FieldDescriptor("wallet", "address", "Wallet bound to the identity (zero until proven)", 0);
        schema.methods[3] = VaultMethodSchema(
            "boundWallet",
            "The wallet that proved ownership of the identity.",
            new FieldDescriptor[](0),
            boundOut,
            new ApproveAction[](0),
            false,
            false,
            false
        );
    }
}
