// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {SocialFeeEscrow} from "./SocialFeeEscrow.sol";

/// @title SocialFeeEscrowDeployer (FLEDGE)
/// @notice Unico proposito: sacar el initcode de SocialFeeEscrow del RUNTIME de
///         SocialFeeEscrowFactory. Deployado UNA vez por la factory en su propio constructor
///         (`factory` queda immutable a esa direccion) y solo esa factory puede llamar `deploy`.
/// @dev Audit v4 (774664f8): `SocialFeeEscrowFactory.newVault` hacia `new SocialFeeEscrow(...)`
///      directo, asi que el initcode ENTERO del vault (16,827 B) vivia embebido dentro del
///      RUNTIME de la factory -- eso es lo que contaba contra el cap de EIP-170 (24,576 B), y
///      dejaba a la factory con apenas 136 B de margen (ver AUDIT-NOTES.md). Aislando el `new
///      SocialFeeEscrow(...)` en este contrato aparte, ese initcode pasa a contar contra el
///      INITCODE del deployer (cap EIP-3860, 49,152 B) en vez del runtime de la factory --
///      mucho mas holgado. Ningun caller precomputa la address del vault (newVault la retorna),
///      asi que este nivel de indireccion no rompe ninguna asuncion existente.
contract SocialFeeEscrowDeployer {
    /// @notice La UNICA factory autorizada a llamar `deploy` -- quien haya desplegado este
    ///         contrato (siempre `SocialFeeEscrowFactory`, ver su constructor).
    address public immutable factory;

    constructor() {
        factory = msg.sender;
    }

    /// @notice Deploya un SocialFeeEscrow nuevo. Gateado a la factory que nos creo: un caller
    ///         random no puede usar este contrato para crear vaults por fuera del flujo de
    ///         `newVault` (normalizacion de identidad, registro, gate del VaultPortal, etc.).
    function deploy(
        address taxToken_,
        address creator_,
        uint8 identityType_,
        string calldata identityValue_,
        address identityWallet_,
        address attesterSource_,
        address xVerifier_,
        uint64 recoveryAfter_
    ) external returns (address) {
        require(msg.sender == factory, unicode"only factory / 仅限工厂");
        return address(
            new SocialFeeEscrow(
                taxToken_, creator_, identityType_, identityValue_, identityWallet_, attesterSource_, xVerifier_, recoveryAfter_
            )
        );
    }
}
