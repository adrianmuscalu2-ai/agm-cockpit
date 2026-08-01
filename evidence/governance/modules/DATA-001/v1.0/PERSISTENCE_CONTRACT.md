# DATA-001 — Contract de persistență v1

- Contract: `prisma-postgresql.v1`;
- provider unic: PostgreSQL;
- configurare exclusiv prin `DATABASE_URL`;
- schema canonică include 15 modele critice;
- 13 modele tenant-owned au `companyId` UUID explicit;
- politica migrațiilor: append-only;
- cele cinci migrații istorice sunt fixate prin SHA-256;
- baseline-ul migrațiilor nu conține DROP TABLE/SCHEMA/DATABASE sau TRUNCATE;
- orice migrare nouă necesită dosar, review, backup, rollback și mandat de execuție;
- Production păstrează un singur writer conform OPS-004.

## NO-GO

- modificarea unei migrații istorice;
- provider diferit de PostgreSQL;
- eliminarea unui model critic sau a tenant ownership;
- operație distructivă fără plan și mandat;
- migrare cu intrări incomplete/failed;
- dual-write sau schimbarea sursei oficiale de date;
- acces la secrete sau Production în acest dosar.

