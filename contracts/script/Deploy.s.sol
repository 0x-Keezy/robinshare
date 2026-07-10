// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {SocialFeeEscrowFactory} from "../src/SocialFeeEscrowFactory.sol";
import {RobinhoodAddresses} from "../src/flap/RobinhoodAddresses.sol";

/// forge script script/Deploy.s.sol --rpc-url robinhood --broadcast --private-key $DEPLOYER_PK
contract Deploy is Script {
    function run() external {
        require(block.chainid == RobinhoodAddresses.CHAIN_ID, "wrong chain (expected 4663)");
        vm.startBroadcast();
        SocialFeeEscrowFactory factory = new SocialFeeEscrowFactory(RobinhoodAddresses.VAULT_PORTAL);
        vm.stopBroadcast();
        console2.log("SocialFeeEscrowFactory:", address(factory));
        console2.log("VaultPortal:", factory.vaultPortal());
    }
}
