import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { graphql } from "ponder";

const app = new Hono();

// Note: /health and /ready endpoints are provided automatically by Ponder
// /health returns 200 immediately after process starts
// /ready returns 200 when indexing is caught up, 503 during backfill

// GraphQL endpoints
app.use("/", graphql({ db, schema }));
app.use("/graphql", graphql({ db, schema }));

export default app;
