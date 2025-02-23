import { TOKEN_DECIMALS } from '../constants.js'
import { createSendMessage } from '../helpers/msg.js'
import MarketplaceProtocol from '../metaprotocol/marketplace.js'
import { AsteroidService } from '../service/asteroid.js'
import { OperationsBase } from './index.js'

export class MarketplaceOperations extends OperationsBase {
  protocol: MarketplaceProtocol
  asteroidService: AsteroidService
  address: string

  constructor(
    chainId: string,
    address: string,
    asteroidService: AsteroidService,
  ) {
    super()
    this.protocol = new MarketplaceProtocol(chainId)
    this.address = address
    this.asteroidService = asteroidService
  }

  listCFT20(
    ticker: string,
    amount: number,
    pricePerToken: number,
    minDepositPercent: number,
    timeoutBlocks: number,
  ) {
    const minDepositMultiplier = minDepositPercent / 100
    const minDepositAbsolute = 0.000001 // @todo move to fee config

    // Calculate the amount of ATOM for the listing fee
    // The listing fee is mindep % of amount * ppt
    let listingFee = amount * pricePerToken * minDepositMultiplier
    // Avoid very small listing fees
    if (listingFee < minDepositAbsolute) {
      listingFee = minDepositAbsolute
    }
    // Convert to uatom decimals from config
    listingFee = listingFee * 10 ** TOKEN_DECIMALS
    listingFee = Math.floor(listingFee)

    return this.prepareOperation(
      this.protocol.listCFT20(
        ticker,
        amount,
        pricePerToken,
        minDepositMultiplier,
        timeoutBlocks,
      ),
      undefined,
      listingFee.toString(),
    )
  }

  delist(listingHash: string) {
    return this.prepareOperation(this.protocol.delist(listingHash))
  }

  async deposit(listingHash: string) {
    const listing = await this.asteroidService.fetchListing(listingHash)
    if (!listing) {
      throw new Error('Listing not found')
    }

    const deposit = BigInt(listing.deposit_total)

    const purchaseMessage = createSendMessage(
      this.address,
      listing.seller_address,
      'uatom',
      deposit.toString(),
    )

    return this.prepareOperation(
      this.protocol.deposit(listingHash),
      undefined,
      undefined,
      [purchaseMessage],
    )
  }

  async buyCFT20(listingHash: string) {
    const listing = await this.asteroidService.fetchListing(listingHash)
    if (!listing) {
      throw new Error('Listing not found')
    }

    let totaluatom = BigInt(listing.total)
    const deposit = BigInt(listing.deposit_total)
    if (deposit > totaluatom) {
      // If deposit is greater than total, then just sent 1uatom to complete the transaction
      totaluatom = BigInt(1)
    } else {
      // Subtract deposit amount already sent
      totaluatom -= deposit
    }

    const purchaseMessage = createSendMessage(
      this.address,
      listing.seller_address,
      'uatom',
      totaluatom.toString(),
    )

    // Calculate the trading fee
    const operation = this.protocol.buyCFT20(listingHash)
    const decimalTotal =
      parseFloat(totaluatom.toString()) / 10 ** TOKEN_DECIMALS

    const feePercentage = parseFloat(operation.fee.amount)
    let buyFee = operation.fee.amount
    if (operation.fee.type == 'dynamic-percent') {
      let fee = decimalTotal * feePercentage
      if (fee < 0.000001) {
        fee = 0.000001
      }
      fee = fee * 10 ** TOKEN_DECIMALS
      buyFee = fee.toFixed(0)
    }

    return this.prepareOperation(operation, undefined, buyFee, [
      purchaseMessage,
    ])
  }
}
