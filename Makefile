
SHELL := /bin/bash
PATH  := ./node_modules/.bin:$(PATH)

SRC_FILES := $(shell find src -name '*.ts')

.PHONY: all
all: dist

.PHONY: test
test: node_modules
	tslint -p tsconfig.json -c tslint.json

.PHONY: lint
lint: node_modules
	tslint -p tsconfig.json -c tslint.json -t stylish --fix

dist: $(SRC_FILES) node_modules
	tsc -p tsconfig.json && \
	chmod +x dist/cli.js && \
	rm dist/cli.d.ts && \
	VERSION="$$(node -p 'require("./package.json").version')"; \
	echo "exports.default = '$${VERSION}';" > dist/version.js && \
	touch dist

node_modules:
	npm ci && \
	touch node_modules

.PHONY: clean
clean:
	rm -rf dist/

.PHONY: distclean
distclean: clean
	rm -rf node_modules/
