# Priority and commitment accounting

VIP is a separate fast-track fee with a percentage food discount. Commitment is a fast-track deposit that becomes prepaid food credit. Settings are copied into the purchase at review creation so later admin changes do not rewrite the customer's agreement. Fast-track activates only after verified payment. Payment immediately runs the reservation-aware allocator: a matching free table calls the guest in the same transaction; otherwise paid guests move ahead of the standard queue for the next suitable table. Paid guests at the same tier retain arrival order.

Amounts are integer paise. An order keeps its original subtotal, discount reason/amount, commitment credit and remaining amount. Credit is reserved transactionally when a draft is created. Repeating the same request returns the same order. Editing a draft before payment starts cancels that draft and releases its credit. Once payment starts, the customer must finish the saved order or ask staff for help; a browser cannot silently replace an in-flight charge.

An order fully covered by credit requires review and explicit confirmation, but does not call Razorpay with a zero amount. The ledger records its settlement as provider/method `credit`. A ₹1,000 commitment against ₹1,600 of food leaves ₹600 payable. Against ₹850 of food it leaves ₹150 unused; the purchase's retained-minimum or refund-unused policy determines its treatment after the visit. Unused credit never becomes a second payment automatically.

Mock priority payments use the existing mock provider. Real priority payments use the same Razorpay order creation, signature checks, captured-payment verification and webhook settlement as food orders. Provider credentials are still required to exercise real payment capture.
