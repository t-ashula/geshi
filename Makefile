.PHONY: db-up db-down dev-up dev-down dev-reset \
	db-schema-dry-run db-schema-apply db-schema-apply-with-drop \
	db-data-migrate \
	e2e-db-up e2e-db-down e2e-db-reset e2e-db-schema-apply \
	test-e2e

PSQLDEF_VERSION ?= 3.11.1
PSQLDEF_IMAGE := sqldef/psqldef:$(PSQLDEF_VERSION)
PSQLDEF_CONFIG_INLINE := 'target_schema: "public"'
DB_SCHEMA_DRY_RUN_LOG := tmp/db-schema-dry-run.log
DB_SCHEMA_APPLY_LOG := tmp/db-schema-apply.log
DB_SCHEMA_APPLY_WITH_DROP_LOG := tmp/db-schema-apply-with-drop.log
DB_NAME ?= geshi
DB_PORT ?= 55432
DEV_COMPOSE := docker compose -f compose.yaml
TEST_COMPOSE := docker compose -f test/compose.test.yaml
DATA_MIGRATION ?=

db-up:
	$(DEV_COMPOSE) up -d postgres

db-down:
	$(DEV_COMPOSE) down -v

dev-up:
	$(DEV_COMPOSE) up -d postgres

dev-down:
	$(DEV_COMPOSE) down

dev-reset:
	$(DEV_COMPOSE) down -v

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

db-schema-apply-with-drop:
	@rm -rf  $(DB_SCHEMA_APPLY_WITH_DROP_LOG)
	@docker run --rm --network host -i $(PSQLDEF_IMAGE) \
		-U geshi \
		-W geshi \
		-h 127.0.0.1 \
		-p $(DB_PORT) \
		$(DB_NAME) \
		--skip-partition \
		--enable-drop \
		--config-inline $(PSQLDEF_CONFIG_INLINE) \
		--apply < db/schema.sql 2>&1 | tee $(DB_SCHEMA_APPLY_WITH_DROP_LOG)

db-data-migrate:
	@test -n "$(DATA_MIGRATION)" || (echo "DATA_MIGRATION is required" >&2; exit 1)
	@COMPOSE_FILE_PATH=compose.yaml DB_NAME=$(DB_NAME) DB_USER=geshi \
		sh scripts/run-data-migration.sh "$(DATA_MIGRATION)"

e2e-db-up:
	$(TEST_COMPOSE) up -d postgres

e2e-db-down:
	$(TEST_COMPOSE) down -v

e2e-db-reset:
	$(TEST_COMPOSE) exec -T postgres \
		psql -U geshi -d postgres \
		-c "DROP DATABASE IF EXISTS geshi_test WITH (FORCE);"
	$(TEST_COMPOSE) exec -T postgres \
		psql -U geshi -d postgres \
		-c "CREATE DATABASE geshi_test;"

e2e-db-schema-apply:
	$(MAKE) db-schema-apply DB_NAME=geshi_test DB_PORT=55433

test-e2e:
	sh test/scripts/run-e2e.sh
