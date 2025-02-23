import { EncodeObject } from '@cosmjs/proto-signing'
import { BaseProtocol, Inscription, Operation } from '../metaprotocol/index.js'
import { prepareTx } from '../metaprotocol/tx.js'

export abstract class OperationsBase {
  abstract protocol: BaseProtocol
  abstract address: string

  prepareOperation(
    operation: Operation,
    inscription?: Inscription,
    feeOverride?: string,
    messages?: readonly EncodeObject[],
  ) {
    return prepareTx(
      this.address,
      operation.urn,
      inscription,
      {
        protocol: this.protocol.fee,
        operation: feeOverride ?? operation.fee.amount,
      },
      messages,
    )
  }
}
