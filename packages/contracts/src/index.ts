import { Schema } from "effect";

export class HealthResponse extends Schema.Class<HealthResponse>("HealthResponse")({
  status: Schema.Literal("ok"),
  runtime: Schema.Literal("bun"),
  transport: Schema.Literal("http"),
}) {}

export class WelcomeResponse extends Schema.Class<WelcomeResponse>("WelcomeResponse")({
  title: Schema.String,
  message: Schema.String,
  capabilities: Schema.Array(Schema.String),
}) {}

export const HealthResponseJson = Schema.standardSchemaV1(HealthResponse);
export const WelcomeResponseJson = Schema.standardSchemaV1(WelcomeResponse);
