// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {VaultFactoryBaseV2} from "./flap/VaultFactoryBaseV2.sol";
import {IVaultFactoryValidationV2} from "./flap/IVaultFactory.sol";
import {VaultDataSchema, FieldDescriptor, FactoryPolicy} from "./flap/IVaultSchemasV1.sol";
import {SocialFeeEscrow} from "./SocialFeeEscrow.sol";

/// @title SocialFeeEscrowFactory (FLEDGE)
/// @notice Factory permissionless para VaultPortal.newTokenV6WithVault: crea un
///         SocialFeeEscrow por token, normaliza la identidad on-chain y mantiene
///         el registro identidad -> vaults. Sin funciones privilegiadas.
contract SocialFeeEscrowFactory is VaultFactoryBaseV2 {
    address public immutable vaultPortal;
    /// @notice El attester CANONICO de esta factory. Se fija al desplegar la factory y
    ///         se inyecta en TODO escrow social que crea — el creator NO puede elegirlo.
    ///         Esto cierra el rug: un creator malicioso no puede nombrar su propia key,
    ///         auto-firmarse un voucher y bindear su wallet salteando la verificacion real.
    ///         Quien quiera otro oraculo despliega su propia factory.
    address public immutable attester;

    mapping(bytes32 => address[]) internal _vaultsByIdentity;
    address[] public allVaults;

    event VaultCreated(
        bytes32 indexed identityHash,
        uint8 identityType,
        string identityValue,
        address indexed vault,
        address indexed taxToken,
        address creator,
        address attester,
        uint64 recoveryAfter
    );

    constructor(address vaultPortal_, address attester_) {
        require(vaultPortal_ != address(0), unicode"zero portal / portal 地址为空");
        require(attester_ != address(0), unicode"zero attester / 认证者地址为空");
        vaultPortal = vaultPortal_;
        attester = attester_;
    }

    /// @dev taxToken es una direccion PREDICHA: el token NO existe todavia. Solo almacenar.
    function newVault(address taxToken, address quoteToken, address creator, bytes calldata vaultData)
        external
        returns (address vault)
    {
        require(msg.sender == vaultPortal, unicode"only vault portal / 仅限 VaultPortal");
        require(quoteToken == address(0), unicode"native quote only / 仅支持原生代币");

        (string memory typeStr, string memory rawValue, address identityWallet, uint256 recoveryDays) =
            abi.decode(vaultData, (string, string, address, uint256));

        uint8 t = _parseType(typeStr);
        require(recoveryDays <= 3650, unicode"recovery too long / 回收期过长");
        uint64 recoveryAfter = recoveryDays == 0 ? 0 : uint64(block.timestamp + recoveryDays * 1 days);

        bytes32 identityHash;
        string memory normalized = "";
        // github → attester canónico de la factory; twitter → XGeneralVerifier oficial de Flap; wallet → ninguno.
        address vaultAttester = t == 1 ? attester : address(0);
        address vaultXVerifier = t == 2 ? _getXVerifier() : address(0);
        if (t == 0) {
            require(bytes(rawValue).length == 0, unicode"value must be empty for wallet / wallet 类型不需要句柄");
            require(identityWallet != address(0), unicode"wallet required / 需要钱包地址");
            identityHash = keccak256(abi.encode(uint8(0), identityWallet));
        } else {
            normalized = _normalize(t, rawValue);
            identityHash = keccak256(abi.encode(t, normalized));
        }

        vault = address(
            new SocialFeeEscrow(
                taxToken, creator, t, normalized, identityWallet, vaultAttester, vaultXVerifier, recoveryAfter
            )
        );
        _vaultsByIdentity[identityHash].push(vault);
        allVaults.push(vault);
        emit VaultCreated(identityHash, t, normalized, vault, taxToken, creator, vaultAttester, recoveryAfter);
    }

    function getVaults(bytes32 identityHash) external view returns (address[] memory) {
        return _vaultsByIdentity[identityHash];
    }

    function allVaultsLength() external view returns (uint256) {
        return allVaults.length;
    }

    /// @notice Hash canonico de una identidad — usa la MISMA normalizacion que el registro.
    ///         El dApp y el attester deben usar esta funcion, nunca re-implementar el hash.
    function identityHashFor(string calldata typeStr, string calldata rawValue, address identityWallet)
        external
        pure
        returns (bytes32)
    {
        uint8 t = _parseType(typeStr);
        if (t == 0) {
            require(identityWallet != address(0), unicode"wallet required / 需要钱包地址");
            return keccak256(abi.encode(uint8(0), identityWallet));
        }
        return keccak256(abi.encode(t, _normalize(t, rawValue)));
    }

    function isQuoteTokenSupported(address quoteToken) external pure returns (bool) {
        return quoteToken == address(0);
    }

    /// @notice El XGeneralVerifier oficial de Flap para esta chain (ruta twitter).
    /// @dev BSC mainnet confirmado por Flap. Robinhood (4663): PENDIENTE de su deploy — hasta
    ///      entonces devuelve 0 y claimByProof revierte (los vaults twitter se pueden crear igual).
    function _getXVerifier() internal view returns (address) {
        if (block.chainid == 56) return 0xcA8DBE6CAC4BFDc41226b0BaF2359fd99989b3E4; // BSC mainnet
        return address(0); // Robinhood 4663 y otras: setear cuando Flap lo despliegue
    }

    /// @notice Expuesto para el dApp / verificación: el verifier que usarán los vaults twitter.
    function xVerifier() external view returns (address) {
        return _getXVerifier();
    }

    function _parseType(string memory s) internal pure returns (uint8) {
        bytes32 h = keccak256(bytes(s));
        if (h == keccak256("wallet")) return 0;
        if (h == keccak256("github")) return 1;
        if (h == keccak256("twitter")) return 2;
        revert(unicode"identity type must be wallet|github|twitter / 身份类型无效");
    }

    /// @dev strip '@' inicial + lowercase ASCII + charset estricto por tipo.
    ///      twitter: 1-15 de [a-z0-9_] · github: 1-39 de [a-z0-9-]. No-ASCII => revert.
    function _normalize(uint8 t, string memory raw) internal pure returns (string memory) {
        bytes memory b = bytes(raw);
        uint256 start = (b.length > 0 && b[0] == "@") ? 1 : 0;
        uint256 len = b.length - start;
        uint256 max = t == 2 ? 15 : 39;
        require(len >= 1 && len <= max, unicode"bad handle length / 句柄长度无效");
        bytes memory out = new bytes(len);
        for (uint256 i = 0; i < len; i++) {
            bytes1 c = b[start + i];
            if (c >= "A" && c <= "Z") c = bytes1(uint8(c) + 32);
            bool ok = (c >= "a" && c <= "z") || (c >= "0" && c <= "9")
                || (t == 2 ? c == bytes1("_") : c == bytes1("-"));
            require(ok, unicode"bad handle charset / 句柄包含非法字符");
            out[i] = c;
        }
        return string(out);
    }

    function vaultDataSchema() public pure override returns (VaultDataSchema memory schema) {
        schema.description =
            "Escrows 100% of the vault share of trading fees for ONE identity. "
            "identityType is 'wallet', 'github' or 'twitter'. For wallet: set identityWallet and leave identityValue empty. "
            "For github/twitter: set identityValue to the handle (no @ needed) - the FLEDGE factory's canonical attester "
            "verifies ownership, the creator cannot choose it. "
            "recoveryDays: 0 = funds wait forever; N = creator can recover if unclaimed after N days.";
        schema.fields = new FieldDescriptor[](4);
        schema.fields[0] = FieldDescriptor("identityType", "string", "wallet | github | twitter", 0);
        schema.fields[1] = FieldDescriptor("identityValue", "string", "Handle for github/twitter (empty for wallet)", 0);
        schema.fields[2] =
            FieldDescriptor("identityWallet", "address", "Recipient wallet (only for identityType=wallet, else 0x0)", 0);
        schema.fields[3] =
            FieldDescriptor("recoveryDays", "uint256", "Days until creator may recover unclaimed funds (0 = never)", 0);
        schema.isArray = false;
    }

    function _validateBeforeLaunch(IVaultFactoryValidationV2.LaunchValidationDataV1 memory data)
        internal
        pure
        override
        returns (bool success, string memory reason)
    {
        if (data.quoteToken != address(0)) {
            return (false, unicode"quote token must be native / 仅支持原生代币");
        }
        if (data.vaultBps == 0) {
            return (false, unicode"vault share (mktBps) must be > 0 or the escrow never receives fees / 金库份额必须大于 0");
        }
        return (true, "");
    }

    function tokenCreationPolicies() public pure override returns (FactoryPolicy[] memory policies) {
        policies = new FactoryPolicy[](2);
        policies[0] =
            FactoryPolicy("quoteToken", "eq", abi.encode(address(0)), "Quote token must be the native token (ETH).");
        policies[1] = FactoryPolicy(
            "mktBps", "gte", abi.encode(uint256(1)), "Vault share of the tax must be greater than zero."
        );
    }
}
