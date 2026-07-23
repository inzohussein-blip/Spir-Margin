-- =====================================================================
-- Migration 0071 : Serial number on sales-order lines
--
-- Medical-device orders often commit a specific unit, so allow an optional
-- serial number per sales-order line.
-- =====================================================================

alter table sales_order_items add column if not exists serial_no text;
