.PHONY: db-up db-down db-schema-dry-run db-schema-apply

PSQLDEF_VERSION ?= 3.10.1
PSQLDEF_IMAGE := sqldef/psqldef:$(PSQLDEF_VERSION)

db-up:
	docker compose up -d postgres

db-down:
	docker compose down -v

db-schema-dry-run:
	docker run --rm --network host -i $(PSQLDEF_IMAGE) \
		-U geshi \
		-W geshi \
		-h 127.0.0.1 \
		-p 55432 \
		geshi \
		--dry-run < db/schema.sql

db-schema-apply:
	docker run --rm --network host -i $(PSQLDEF_IMAGE) \
		-U geshi \
		-W geshi \
		-h 127.0.0.1 \
		-p 55432 \
		geshi \
		--apply < db/schema.sql
