// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ECDSA} from "openzeppelin-contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "openzeppelin-contracts/utils/cryptography/EIP712.sol";
import {Strings} from "openzeppelin-contracts/utils/Strings.sol";
import {VaultBaseV2} from "./flap/VaultBaseV2.sol";
import {VaultUISchema, VaultMethodSchema, FieldDescriptor, ApproveAction} from "./flap/IVaultSchemasV1.sol";

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
    address public immutable attester;
    uint64 public immutable recoveryAfter; // 0 = nunca
    string public identityValue; // normalizada por la factory; vacia para TYPE_WALLET

    address public boundWallet; // 0x0 hasta probar identidad; TYPE_WALLET la fija el constructor
    uint256 public bindNonce;
    uint256 public totalPaid;

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
        uint64 recoveryAfter_
    ) EIP712("SocialFeeEscrow", "1") {
        require(identityType_ <= TYPE_TWITTER, unicode"bad identity type / 身份类型无效");
        taxToken = taxToken_;
        creator = creator_;
        identityType = identityType_;
        identityValue = identityValue_;
        attester = attester_;
        recoveryAfter = recoveryAfter_;
        if (identityType_ == TYPE_WALLET) {
            require(identityWallet_ != address(0), unicode"wallet required / 需要钱包地址");
            boundWallet = identityWallet_;
            emit Bound(identityWallet_, 0);
        } else {
            require(attester_ != address(0), unicode"attester required / 需要认证者地址");
        }
    }

    /// @notice Recibe el tax del TaxProcessor de Flap.
    /// @dev CUERPO VACIO — invariante dura. Sin SSTORE, sin eventos, sin require:
    ///      si esto revierte (p.ej. con stipend de 2300 gas), esa porcion del tax
    ///      va al fee receiver de Flap PARA SIEMPRE, sin retry.
    receive() external payable {}

    // ---- stubs que la Task 7 completa (necesarios para que VaultBaseV2 compile) ----
    function description() public view virtual override returns (string memory) {
        return "FLEDGE fee escrow";
    }

    function vaultUISchema() public pure virtual override returns (VaultUISchema memory schema) {
        schema.vaultType = "SocialFeeEscrow";
    }
}
