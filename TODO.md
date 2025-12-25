# TODO for Modifying /bookings/my Endpoint

- [x] Update the SQL query in getMyBookings function to use the specified aliases and INNER JOIN with WHERE b.userid = $1
- [x] Modify the response logic to parse rawresponse for redirectUrl and structure the payment object with all payment fields
