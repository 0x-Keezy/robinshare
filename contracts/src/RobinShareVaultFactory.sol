// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {RobinShareVault} from "./RobinShareVault.sol";

/// @title RobinShareVaultFactory — despliega y registra los vaults del rail pons
/// @notice Permissionless: cualquiera crea un vault para cualquier identidad. Eso es el producto,
///         no un bug — lanzar una moneda "para" un dev que no la pidio es el caso de uso.
///
/// @dev PORT desde el rail de Flap. El entrypoint viejo (`newVault`, gateado al VaultPortal, con
///      un blob `vaultData` opaco) no tiene equivalente en pons: el launchpad nunca llama a una
///      factory de vaults de terceros. Acá el vault se crea PRIMERO, con parametros tipados, y
///      recien despues se lanza el token apuntandole las creator fees.
contract RobinShareVaultFactory {
    uint8 public constant TYPE_WALLET = 0;
    uint8 public constant TYPE_GITHUB = 1;
    uint8 public constant TYPE_TWITTER = 2;

    /// @notice Piso del plazo de recovery. 0 sigue significando NUNCA (el default del producto).
    /// @dev Sin piso, un plazo corto deja al launcher recuperar el balance antes de que la persona
    ///      real tenga chance razonable de reclamarlo.
    uint256 public constant MIN_RECOVERY_DAYS = 30;
    uint256 public constant MAX_RECOVERY_DAYS = 3650;

    address public immutable feeEscrow;
    address public immutable ponsFactory;
    address public immutable xVerifier;

    /// @notice El attester vigente de la ruta GitHub. Los vaults lo leen EN VIVO de aca.
    /// @dev Rotable solo por el attester vigente: no hay Guardian de respaldo (era de Flap). Si la
    ///      llave se pierde sin rotar, la ruta GitHub queda sin sucesor — riesgo aceptado y
    ///      registrado en el spec; la custodia del attester es decision abierta.
    address public attester;

    /// @notice Registro de procedencia. Lo consulta el attester server ANTES de firmar nada.
    /// @dev Sin esto, cualquiera despliega un contrato que finge ser un vault. Es la segunda capa
    ///      del fix de la firma en blanco; la primera es que el server calcula el digest el mismo.
    mapping(address => bool) public isVault;

    mapping(bytes32 => address[]) private _vaultsByIdentity;
    address[] public allVaults;

    event VaultCreated(
        bytes32 indexed identityHash,
        uint8 identityType,
        string identityValue,
        address vault,
        address launcher,
        uint64 recoveryAfter
    );
    event AttesterRotated(address indexed oldAttester, address indexed newAttester);

    error ZeroAddress();
    error OnlyAttester();
    error BadIdentityType();
    error RecoveryWindowTooShort();
    error RecoveryWindowTooLong();
    error ValueMustBeEmptyForWallet();
    error WalletRequired();
    error EmptyValue();

    constructor(address attester_, address feeEscrow_, address ponsFactory_, address xVerifier_) {
        if (attester_ == address(0) || feeEscrow_ == address(0) || ponsFactory_ == address(0)) {
            revert ZeroAddress();
        }
        attester = attester_;
        feeEscrow = feeEscrow_;
        ponsFactory = ponsFactory_;
        xVerifier = xVerifier_; // puede ser 0 si la chain no tiene verifier: los vaults X se rechazan
    }

    function rotateAttester(address newAttester) external {
        if (msg.sender != attester) revert OnlyAttester();
        if (newAttester == address(0)) revert ZeroAddress();
        emit AttesterRotated(attester, newAttester);
        attester = newAttester;
    }

    /// @notice Crea un vault para una identidad. Permissionless.
    /// @param identityType_ 0 = wallet, 1 = github, 2 = twitter/X
    /// @param rawValue el handle (vacio para wallet). Se normaliza on-chain.
    /// @param identityWallet_ solo para TYPE_WALLET.
    /// @param recoveryDays 0 = NUNCA (default del producto), o >= 30 y <= 3650.
    function createVault(
        uint8 identityType_,
        string calldata rawValue,
        address identityWallet_,
        uint256 recoveryDays
    ) external returns (address vault) {
        if (identityType_ > TYPE_TWITTER) revert BadIdentityType();
        if (recoveryDays != 0 && recoveryDays < MIN_RECOVERY_DAYS) revert RecoveryWindowTooShort();
        if (recoveryDays > MAX_RECOVERY_DAYS) revert RecoveryWindowTooLong();

        uint64 recoveryAfter =
            recoveryDays == 0 ? 0 : uint64(block.timestamp + recoveryDays * 1 days);

        bytes32 identityHash;
        string memory normalized = "";
        address vaultAttesterSource = identityType_ == TYPE_GITHUB ? address(this) : address(0);
        address vaultXVerifier = identityType_ == TYPE_TWITTER ? xVerifier : address(0);

        if (identityType_ == TYPE_WALLET) {
            if (bytes(rawValue).length != 0) revert ValueMustBeEmptyForWallet();
            if (identityWallet_ == address(0)) revert WalletRequired();
            identityHash = keccak256(abi.encode(uint8(0), identityWallet_));
        } else {
            normalized = _normalize(rawValue);
            if (bytes(normalized).length == 0) revert EmptyValue();
            identityHash = keccak256(abi.encode(identityType_, normalized));
        }
        // Un vault X sin verifier quedaria brickeado para siempre (xVerifier es immutable en el
        // vault y claimByProof revertiria eternamente).
        if (identityType_ == TYPE_TWITTER && vaultXVerifier == address(0)) revert ZeroAddress();

        vault = address(
            new RobinShareVault(
                msg.sender,
                identityType_,
                normalized,
                identityWallet_,
                vaultAttesterSource,
                vaultXVerifier,
                recoveryAfter,
                feeEscrow,
                ponsFactory
            )
        );

        isVault[vault] = true;
        _vaultsByIdentity[identityHash].push(vault);
        allVaults.push(vault);
        emit VaultCreated(identityHash, identityType_, normalized, vault, msg.sender, recoveryAfter);
    }

    function getVaults(bytes32 identityHash) external view returns (address[] memory) {
        return _vaultsByIdentity[identityHash];
    }

    function allVaultsLength() external view returns (uint256) {
        return allVaults.length;
    }

    /// @notice El mismo hash que usa `createVault`, para que el server pueda ubicar los vaults de
    ///         una identidad sin recorrer `allVaults`.
    function identityHashFor(uint8 identityType_, string calldata rawValue, address identityWallet_)
        external
        pure
        returns (bytes32)
    {
        if (identityType_ == TYPE_WALLET) return keccak256(abi.encode(uint8(0), identityWallet_));
        return keccak256(abi.encode(identityType_, _normalize(rawValue)));
    }

    /// @dev Normalizacion: strip de un '@' inicial y lowercase ASCII. Idempotente.
    function _normalize(string memory raw) internal pure returns (string memory) {
        bytes memory b = bytes(raw);
        uint256 start = (b.length > 0 && b[0] == "@") ? 1 : 0;
        bytes memory out = new bytes(b.length - start);
        for (uint256 i = start; i < b.length; i++) {
            bytes1 c = b[i];
            out[i - start] = (c >= 0x41 && c <= 0x5A) ? bytes1(uint8(c) + 32) : c;
        }
        return string(out);
    }
}
