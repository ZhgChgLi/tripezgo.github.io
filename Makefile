.PHONY: setup dev test build clean doctor

setup:
	bin/setup

dev:
	bin/dev

test:
	bin/test

build:
	bundle exec jekyll build --strict_front_matter --trace

clean:
	bundle exec jekyll clean

doctor:
	bin/doctor
