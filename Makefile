.PHONY: db-up db-down db-schema-dry-run db-schema-apply \
	e2e-db-up e2e-db-reset e2e-db-schema-apply test-e2e

PSQLDEF_VERSION ?= 3.11.1
PSQLDEF_IMAGE := sqldef/psqldef:$(PSQLDEF_VERSION)
PSQLDEF_CONFIG_INLINE := 'target_schema: "public"'
DB_SCHEMA_DRY_RUN_LOG := tmp/db-schema-dry-run.log
DB_SCHEMA_APPLY_LOG := tmp/db-schema-apply.log
DB_NAME ?= geshi
DB_PORT ?= 55432

db-up:
	docker compose --profile dev up -d postgres

db-down:
	docker compose --profile dev down -v

db-schema-dry-run:
	@rm -rf  $(DB_SCHEMA_DRY_RUN_LOG)
	@docker run --rm --network host -i $(PSQLDEF_IMAGE) \
		-U geshi \
		-W geshi \
		-h 127.0.0.1 \
		-p $(DB_PORT) \
		$(DB_NAME) \
		--skip-partition \
		--config-inline $(PSQLDEF_CONFIG_INLINE) \
		--dry-run < db/schema.sql 2>&1 | tee $(DB_SCHEMA_DRY_RUN_LOG)

db-schema-apply:
	@rm -rf  $(DB_SCHEMA_APPLY_LOG)
	@docker run --rm --network host -i $(PSQLDEF_IMAGE) \
		-U geshi \
		-W geshi \
		-h 127.0.0.1 \
		-p $(DB_PORT) \
		$(DB_NAME) \
		--skip-partition \
		--config-inline $(PSQLDEF_CONFIG_INLINE) \
		--apply < db/schema.sql 2>&1 | tee $(DB_SCHEMA_APPLY_LOG)

e2e-db-up:
	docker compose --profile e2e up -d postgres

e2e-db-reset:
	docker compose --profile e2e exec -T postgres \
		psql -U geshi -d postgres \
		-c "DROP DATABASE IF EXISTS geshi_test WITH (FORCE);"
	docker compose --profile e2e exec -T postgres \
		psql -U geshi -d postgres \
		-c "CREATE DATABASE geshi_test;"

e2e-db-schema-apply:
	$(MAKE) db-schema-apply DB_NAME=geshi_test

test-e2e:
	sh test/scripts/run-e2e.sh
