// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Superficie MINIMA de pons v2 que RobinShare necesita, transcrita de la fuente
///         VERIFICADA en Blockscout (chainId 4663). No se copia el protocolo entero: solo lo
///         que se llama, para que el ABI sea auditable de un vistazo.

/// @notice Ledger pull-payment de pons. Verificado, NO es proxy, no tiene owner ni claimFor.
/// @dev `claim()` es ESTRICTAMENTE msg.sender: nadie puede cobrar en nombre de otro. Por eso el
///      vault tiene que llamarlo el mismo. Paga con `.call{value:}` reenviando TODO el gas (sin
///      stipend de 2300), asi que el receptor necesita un `receive()` payable o revierte
///      `TransferFailed()`. Si el saldo es cero revierte `NoBalance()` (0xc2caa2a6) — por eso
///      siempre se consulta `balanceOf` antes de llamar.
interface IV2FeeEscrow {
    function claim() external returns (uint256 amount);
    function claimToken(address token) external returns (uint256 amount);
    function balanceOf(address recipient) external view returns (uint256);
    function balanceOfToken(address recipient, address token) external view returns (uint256);
}

/// @notice La curva de bonding de un launch pre-graduacion.
/// @dev OJO con el nombre: el campo `deployer` de la curva NO es quien lanzo — es el
///      **creatorFeeRecipient vigente**. La fuente lo dice ("Token creator, credited as the
///      creator fee recipient"), `setCreatorFeeRecipient` lo muta, y `_creditQuote(deployer, ...)`
///      acredita ahi. Por eso NUESTRO vault, siendo el recipient, esta autorizado a barrer.
interface IPonsV2Curve {
    function sweepFees(uint256 minBuybackTokensOut) external;
    function deployer() external view returns (address);
    function graduated() external view returns (bool);
}

/// @notice Registro de launches del factory de pons v2.
interface IPonsV2LaunchFactory {
    struct LaunchedToken {
        address token;
        address curve;
        address deployer;
        address creatorFeeRecipient;
        address pairToken;
        uint256 graduationThreshold;
        uint24 poolFee;
        int24 tickSpacing;
        uint16 creatorTaxBps;
        bool buybackEnabled;
        uint8 phase; // enum GraduationPhase
        uint256 sweptQuote;
        uint256 sweptTokens;
        uint256 sweptAt;
        bool exists;
    }

    function getLaunchedToken(address token) external view returns (LaunchedToken memory);
}
