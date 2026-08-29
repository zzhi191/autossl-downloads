import assert from "node:assert/strict";
import test from "node:test";
import { SCENES, TOTAL_FRAMES } from "../src/storyboard.mjs";

test("AutoSSL storyboard has six contiguous scenes covering 15 seconds", () => {
  assert.equal(TOTAL_FRAMES, 450);
  assert.equal(SCENES.length, 6);
  assert.equal(SCENES[0].from, 0);
  assert.equal(SCENES.at(-1).to, TOTAL_FRAMES);

  for (let index = 1; index < SCENES.length; index += 1) {
    assert.equal(SCENES[index - 1].to, SCENES[index].from);
  }
});
