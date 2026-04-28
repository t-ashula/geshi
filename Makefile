.PHONY: db-up db-down db-schema-dry-run db-schema-apply

PSQLDEF_VERSION ?= 3.11.1
PSQLDEF_IMAGE := sqldef/psqldef:$(PSQLDEF_VERSION)
PSQLDEF_CONFIG_INLINE := 'target_schema: ["public"]'
DB_SCHEMA_DRY_RUN_LOG := tmp/db-schema-dry-run.log
DB_SCHEMA_APPLY_LOG := tmp/db-schema-apply.log

db-up:
	docker compose up -d postgres

db-down:
	docker compose down -v

db-schema-dry-run:
	@mkdir -p tmp
	@bash -lc 'set -o pipefail; \
		docker run --rm --network host -i $(PSQLDEF_IMAGE) \
			-U geshi \
			-W geshi \
			-h 127.0.0.1 \
			-p 55432 \
			geshi \
			--config-inline=$(PSQLDEF_CONFIG_INLINE) \
			--dry-run < db/schema.sql 2>&1 | tee $(DB_SCHEMA_DRY_RUN_LOG)'

db-schema-apply:
	@mkdir -p tmp
	@bash -lc 'set -o pipefail; \
		docker run --rm --network host -i $(PSQLDEF_IMAGE) \
			-U geshi \
			-W geshi \
			-h 127.0.0.1 \
			-p 55432 \
			geshi \
			--config-inline=$(PSQLDEF_CONFIG_INLINE) \
			--apply < db/schema.sql 2>&1 | tee $(DB_SCHEMA_APPLY_LOG)'
