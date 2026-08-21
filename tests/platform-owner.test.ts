import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { isPlatformOwner } from "@/lib/env";

const original = process.env.PLATFORM_OWNER_EMAILS;

afterEach(() => {
  if (original === undefined) delete process.env.PLATFORM_OWNER_EMAILS;
  else process.env.PLATFORM_OWNER_EMAILS = original;
});

describe("shared-library owner gate", () => {
  it("denies everyone when the allow-list is unset", () => {
    // Fail closed: an unconfigured deployment must not let any teacher publish
    // questions that every other teacher would see.
    delete process.env.PLATFORM_OWNER_EMAILS;
    assert.equal(isPlatformOwner("supratimdebshan@gmail.com"), false);

    process.env.PLATFORM_OWNER_EMAILS = "";
    assert.equal(isPlatformOwner("supratimdebshan@gmail.com"), false);
  });

  it("allows only listed emails, case-insensitively", () => {
    process.env.PLATFORM_OWNER_EMAILS = "Owner@Padho.app, second@padho.app";

    assert.equal(isPlatformOwner("owner@padho.app"), true);
    assert.equal(isPlatformOwner("OWNER@PADHO.APP"), true);
    assert.equal(isPlatformOwner("second@padho.app"), true);
    assert.equal(isPlatformOwner("someone.else@padho.app"), false);
  });

  it("rejects a missing email rather than treating it as a match", () => {
    process.env.PLATFORM_OWNER_EMAILS = "owner@padho.app";

    assert.equal(isPlatformOwner(null), false);
    assert.equal(isPlatformOwner(undefined), false);
    assert.equal(isPlatformOwner(""), false);
  });
});
