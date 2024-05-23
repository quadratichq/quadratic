import * as pulumi from "@pulumi/pulumi";

const config = new pulumi.Config();

// Configuration from command line
export const isPreviewEnvironment = config.get("is-preview") === "true";
