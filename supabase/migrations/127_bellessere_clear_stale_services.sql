-- Clear bellessere_services so ensureFresh() re-syncs with the corrected
-- calendarType filter (was === 'service', now !== 'personal') on next page load
delete from bellessere_services where location_id = '38lvVkcTVVRFDDcHqYd1';
