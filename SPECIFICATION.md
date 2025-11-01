# Take-home Assignment: Working with Events

<aside>
👋 Hey there! We’re very excited to move forward with your application and get a chance to dive deeper into the Senior Backend Engineer role at [LI.FI](http://li.fi/)! You can share your solution via GitHub or any similar easy-to-review format. If you want your link to stay private, you can invite our team members directly so they can review your code but make sure to still send us the link of the repository: <CallumGrindle> and <mathiasmoeller>.
Please make sure that your submission is:

(a) carefully crafted: it's ok to take functional shortcuts, but structurally the code must be sound;
(b) production-ready: in the sense that thorough error handling and tests are a must, not a good to have;
(c) simple: please avoid using big opinionated frameworks like NestJS;
(d) well-documented: please add comments to your code, and document any next steps you would take or any areas you didn’t have time to implement fully.

Remember, we're looking for an example of the type of work you strive for, not just a proof of concept. Please aim to demonstrate the quality and standard of work you’d bring to the team.

If you have any questions or doubts, please reach out to María <maria@li.finance>.

</aside>

# Background

We have a Smart Contract which is responsible for collecting fees for our transactions when certain conditions are met. This contract is called the `FeeCollector` and is deployed to all EVM chains that we support. [You can see if for example on Polygon](https://polygonscan.com/address/0xbD6C7B0d2f68c2b7805d88388319cfB6EcB50eA9).

Every time a transaction is submitted that includes fee collection, an event is emitted on this contract. You can see those events [here](https://polygonscan.com/address/0xbD6C7B0d2f68c2b7805d88388319cfB6EcB50eA9#events).

<aside>
💡 Transactions are grouped in EVM Chains in so called blocks. Every block has a unique tag. Emitted events on a smart contract can be queried for a range of blocks.

</aside>

We would like to have the functionality to scan those emitted events, store them in our database and request them based on the integrator that the fees were collected for.

# Acceptance Criteria

- We would like to have a tool that scrapes the contract for emitted `FeesCollected` event on a given chain
- The tool should be able to be started at any time to retrieve new events
- The tool should work efficiently and not scan the same blocks again
- The retrieved events should be stored in a MongoDB database using Typegoose
- Optional 1: Write a small REST endpoint that allows to retrieve all collected events for a given `integrator`
- Optional 2: Wrap the application into a usable Docker image
- The solution should be built in TypeScript, it should include all information on how to run it

# Implementation Consideration

- You can focus on the Polygon Chain for now, but the concept should take into consideration that we want this for all our EVM chains
- You can use `77000000` as the oldest block to take into consideration

# Helper Functions

The below code snippets provides some examples how to load the FeeCollector events from Polygon. 
Feel free to use the code for your solution but feel free to change anything to fit your and the applications needs.

```tsx
import { BigNumber, ethers } from 'ethers' // please use ethers v5 to ensure compatibility
import { FeeCollector__factory } from 'lifi-contract-types'
import { BlockTag } from '@ethersproject/abstract-provider'

const CONTRACT_ADDRESS = '0xbD6C7B0d2f68c2b7805d88388319cfB6EcB50eA9'
const POLYGON_RPC = 'https://polygon-rpc.com'

interface ParsedFeeCollectedEvents {
  token: string; // the address of the token that was collected
  integrator: string; // the integrator that triggered the fee collection
  integratorFee: BigNumber; // the share collector for the integrator
  lifiFee: BigNumber; // the share collected for lifi
}

/**
 * For a given block range all `FeesCollected` events are loaded from the Polygon FeeCollector
 * @param fromBlock
 * @param toBlock
 */
const loadFeeCollectorEvents = (fromBlock: BlockTag, toBlock: BlockTag): Promise<ethers.Event[]> => {
  const feeCollector = new ethers.Contract(
    CONTRACT_ADDRESS,
    FeeCollector__factory.createInterface(),
    new ethers.providers.JsonRpcProvider(POLYGON_RPC)
  )
  const filter = feeCollector.filters.FeesCollected()
  return feeCollector.queryFilter(filter, fromBlock, toBlock)
}

/**
 * Takes a list of raw events and parses them into ParsedFeeCollectedEvents
 * @param events
 */
const parseFeeCollectorEvents = (
  events: ethers.Event[],
): ParsedFeeCollectedEvents[] => {
  const feeCollectorContract = new ethers.Contract(
    CONTRACT_ADDRESS,
    FeeCollector__factory.createInterface(),
    new ethers.providers.JsonRpcProvider(POLYGON_RPC)
  )

  return events.map(event => {
    const parsedEvent = feeCollectorContract.interface.parseLog(event)

    const feesCollected: ParsedFeeCollectedEvents = {
      token: parsedEvent.args[0],
      integrator: parsedEvent.args[1],
      integratorFee: BigNumber.from(parsedEvent.args[2]),
      lifiFee: BigNumber.from(parsedEvent.args[3]),
    }
    return feesCollected
  })
}
```