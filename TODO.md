# Task: Add payment response fields to GET /bookings/my endpoint

## Completed Steps:

- [x] Analyze the codebase and understand the structure
- [x] Verify payments table relation with bookings via bookingId
- [x] Modify createBooking function to store token and redirectUrl in payments table
- [x] Modify getMyBookings function to join with payments table and include payment fields in response
- [x] Transform response to include payment object with orderId, token, redirectUrl

## Followup Steps:

- [ ] Test the endpoints to ensure the response includes the payment fields for each booking
- [ ] If database migration is needed for token and redirectUrl columns, perform it
