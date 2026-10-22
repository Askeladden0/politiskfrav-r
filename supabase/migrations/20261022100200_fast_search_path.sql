-- Rådgiveren advarte om mutabel search_path. Funksjonen bruker bare fullt kvalifiserte navn.
alter function private.min_epost() set search_path = '';
