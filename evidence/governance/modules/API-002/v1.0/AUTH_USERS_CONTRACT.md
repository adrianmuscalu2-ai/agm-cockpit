# API-002 — Contract Auth & Users v1

**Contract:** `auth-users.v1`  
**Scope JWT:** `user`  
**Expirare implicită:** 1 oră

## Login

- DTO impune e-mail valid și parolă de minimum 8 caractere;
- răspunsul pentru identitate absentă, inactivă sau parolă greșită este uniform: `Invalid credentials.`;
- căutarea e-mailului este case-insensitive și elimină spațiile marginale;
- o identitate ambiguă între tenant-uri este respinsă;
- limita dedicată este 5 încercări în 60 secunde, cu blocare 60 secunde.

## Sesiune și autorizare

- tokenul conține `sub`, `companyId`, rolurile active și scope `user`;
- expirarea este obligatorie și verificată de strategia JWT;
- utilizatorul trebuie să fie `Active`;
- compania din token trebuie să coincidă cu cea din persistence;
- rolurile din token nu sunt considerate autoritate: contextul le recitește și acceptă numai roluri active din același tenant.

## Failure / recovery

Un login sau token invalid produce `401` fără expunerea motivului sensibil. Recuperarea se face prin credențiale valide și stare activă; incidentele operaționale sunt corelate prin OPS-003.

## NO-GO

- selectarea arbitrară a unui utilizator pentru e-mail multi-tenant ambiguu;
- acces pentru utilizator inactiv, tenant diferit sau scope diferit;
- acceptarea rolurilor inactive, străine ori exclusiv din payload-ul JWT;
- logarea parolei, hash-ului, secretului JWT sau tokenului;
- secret JWT absent/slab ori token fără expirare;
- modificări Production fără mandat OPS-004.

