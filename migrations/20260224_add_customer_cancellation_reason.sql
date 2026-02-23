-- Customer cancel: reason given by user when they cancel from the app. Admin cannot set this.
ALTER TABLE requests
  ADD COLUMN customer_cancellation_reason TEXT NULL;
