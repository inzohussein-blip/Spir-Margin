-- =====================================================================
-- Migration 0116 : Sign in to the whole system with the activation code
--
-- The company's activation code also opens the whole system on the computer
-- it activated (as the administrator; staff then get accounts of their own
-- on the Users page). Only a fingerprint of the code is kept — the same
-- sha256 the codes server keeps — so it is checked offline and the code
-- itself is never stored. Empty until the code is entered on this computer.
-- =====================================================================

alter table _spir_license add column if not exists code_hash text not null default '';
