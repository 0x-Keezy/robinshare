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
    /// @notice El attester CANONICO de esta factory: lo inyecta en TODO escrow social que
    ///         crea — el creator NO puede elegirlo. Esto cierra el rug: un creator malicioso
    ///         no puede nombrar su propia key, auto-firmarse un voucher y bindear su wallet
    ///         salteando la verificacion real. Quien quiera otro oraculo despliega su factory.
    /// @dev Preaudit Flap (High): ya no es immutable — el attester VIGENTE puede designar un
    ///      sucesor (rotateAttester). Los vaults leen esta variable EN VIVO, asi que rotar
    ///      invalida los vouchers de la key vieja en todos los vaults, pasados y futuros.
    /// @dev Audit v3 (High, finding 5): rotateAttester ya NO es self-gated — el Guardian
    ///      oficial de Flap (_getGuardian()) tambien puede rotar, como backup si la key del
    ///      attester se pierde o se compromete y nadie mas puede invocar la rotacion.
    address public attester;

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
    event AttesterRotated(address indexed oldAttester, address indexed newAttester);

    constructor(address attester_) {
        require(attester_ != address(0), unicode"zero attester / 认证者地址为空");
        attester = attester_;
    }

    /// @notice El attester vigente designa a su sucesor (rotacion de key: higiene o compromiso
    ///         parcial). El Guardian oficial de Flap tambien puede rotar (Audit v3 finding 5):
    ///         si la key del attester se pierde o se compromete del todo, el attester mismo ya
    ///         no puede llamar esta funcion — el Guardian es el backup que evita que TODOS los
    ///         vaults github queden bloqueados para siempre.
    function rotateAttester(address newAttester) external {
        require(
            msg.sender == attester || msg.sender == _getGuardian(),
            unicode"only attester or guardian / 仅限认证者或 Guardian"
        );
        require(newAttester != address(0), unicode"zero attester / 认证者地址为空");
        emit AttesterRotated(attester, newAttester);
        attester = newAttester;
    }

    /// @notice El VaultPortal oficial de esta chain — el UNICO caller valido de newVault.
    /// @dev Preaudit Flap (High, obligatorio): el gate ya no es un constructor param que un
    ///      deploy equivocado podria apuntar a cualquier lado; sale de _getVaultPortal()
    ///      (hardcodeado per-chain en VaultFactoryBaseV2, patron de flap-sh/FlapVaultExample).
    function vaultPortal() external view returns (address) {
        return _getVaultPortal();
    }

    /// @dev taxToken es una direccion PREDICHA: el token NO existe todavia. Solo almacenar.
    function newVault(address taxToken, address quoteToken, address creator, bytes calldata vaultData)
        external
        returns (address vault)
    {
        require(msg.sender == _getVaultPortal(), unicode"only vault portal / 仅限 VaultPortal");
        require(quoteToken == address(0), unicode"native quote only / 仅支持原生代币");

        (string memory typeStr, string memory rawValue, address identityWallet, uint256 recoveryDays) =
            abi.decode(vaultData, (string, string, address, uint256));

        uint8 t = _parseType(typeStr);
        // Audit v3 (High, finding 3): piso de 30 dias — sin minimo, un recoveryDays chico
        // permitia al creator recuperar (seizure) el balance social ANTES de que la identidad
        // real tuviera chance razonable de reclamarlo. 0 sigue significando "nunca".
        require(recoveryDays == 0 || recoveryDays >= 30, unicode"recovery window too short / 回收期过短");
        require(recoveryDays <= 3650, unicode"recovery too long / 回收期过长");
        uint64 recoveryAfter = recoveryDays == 0 ? 0 : uint64(block.timestamp + recoveryDays * 1 days);

        bytes32 identityHash;
        string memory normalized = "";
        // github → la FACTORY como fuente viva del attester (rotable); twitter → XGeneralVerifier
        // oficial de Flap; wallet → ninguno.
        address vaultAttesterSource = t == 1 ? address(this) : address(0);
        address vaultXVerifier = t == 2 ? _getXVerifier() : address(0);
        if (t == 0) {
            require(bytes(rawValue).length == 0, unicode"value must be empty for wallet / wallet 类型不需要句柄");
            require(identityWallet != address(0), unicode"wallet required / 需要钱包地址");
            identityHash = keccak256(abi.encode(uint8(0), identityWallet));
        } else {
            normalized = _normalize(t, rawValue);
            identityHash = keccak256(abi.encode(t, normalized));
        }
        // Preaudit Flap (High): un vault twitter creado sin XGeneralVerifier en esta chain
        // quedaria brickeado para siempre (xVerifier es immutable en el vault y claimByProof
        // revertiria eternamente). Rechazar la creacion hasta que Flap lo despliegue.
        if (t == 2) {
            require(vaultXVerifier != address(0), unicode"x verifier not deployed on this chain / 本链暂无 X 验证器");
        }

        vault = address(
            new SocialFeeEscrow(
                taxToken, creator, t, normalized, identityWallet, vaultAttesterSource, vaultXVerifier, recoveryAfter
            )
        );
        _vaultsByIdentity[identityHash].push(vault);
        allVaults.push(vault);
        emit VaultCreated(
            identityHash, t, normalized, vault, taxToken, creator, t == 1 ? attester : address(0), recoveryAfter
        );
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
        // Audit v3 (High, finding 1, SYS-REQ-LITERAL-ERRORS): require() en vez de un
        // revert(unicode"...") suelto — misma condicion, mismo mensaje, forma mandatada.
        require(false, unicode"identity type must be wallet|github|twitter / 身份类型无效");
        return 0; // inalcanzable: el require de arriba siempre revierte aca
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
        // Audit v3 (High, finding 2, SYS-REQ-MULTILANG): las views user-facing tambien son
        // bilingues, igual que los require/revert. Traducciones deliberadamente concisas: cada
        // string chino agrega bytecode a la factory y el runtime debe seguir bajo EIP-170.
        schema.description = unicode"Escrows fees for ONE identity; only the proven identity can claim. "
            unicode"github/twitter use FLEDGE's canonical attester. recoveryDays: 0=never, else 30-3650."
            unicode" / 为单一身份托管手续费，只有已证明身份可领取。"
            unicode"github/twitter 由 FLEDGE 官方认证者验证。recoveryDays：0=永不，否则 30-3650。";
        schema.fields = new FieldDescriptor[](4);
        schema.fields[0] = FieldDescriptor("identityType", "string", unicode"wallet | github | twitter / 身份类型", 0);
        schema.fields[1] =
            FieldDescriptor("identityValue", "string", unicode"Handle for github/twitter / github/twitter 句柄", 0);
        schema.fields[2] =
            FieldDescriptor("identityWallet", "address", unicode"Recipient wallet (wallet type) / 收款钱包（wallet 类型）", 0);
        schema.fields[3] = FieldDescriptor(
            "recoveryDays", "uint256", unicode"Recover wait days (0=never, else 30-3650) / 回收等待天数（0=永不，否则 30-3650）", 0
        );
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
            return (false, unicode"vault share (mktBps) must be > 0 / 金库份额必须大于 0");
        }
        return (true, "");
    }

    function tokenCreationPolicies() public pure override returns (FactoryPolicy[] memory policies) {
        policies = new FactoryPolicy[](2);
        policies[0] = FactoryPolicy(
            "quoteToken", "eq", abi.encode(address(0)), unicode"Quote token must be native (ETH). / 报价代币须为原生代币"
        );
        policies[1] = FactoryPolicy(
            "mktBps", "gte", abi.encode(uint256(1)), unicode"Vault share of tax must be > 0. / 金库份额须大于零"
        );
    }
}
