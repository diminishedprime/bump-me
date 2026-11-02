import type { NodePath } from "@babel/traverse";
import type { Node } from "@babel/types";
import type { Ignorer } from "@stryker-mutator/api/ignore";
import { declareValuePlugin, PluginKind } from "@stryker-mutator/api/plugin";

class LoggingIgnorer implements Ignorer {
  shouldIgnore({ node }: NodePath) {
    if (
      LoggingIgnorer.isLoggerCall(node) ||
      (node.type === "ExpressionStatement" &&
        LoggingIgnorer.isLoggerCall(node.expression))
    ) {
      return "logging is excluded from mutation testing";
    }
    return undefined;
  }

  private static isLoggerCall(node: Node) {
    return (
      node.type === "CallExpression" &&
      node.callee.type === "MemberExpression" &&
      node.callee.object.type === "MemberExpression" &&
      node.callee.object.object.type === "ThisExpression" &&
      node.callee.object.property.type === "Identifier" &&
      node.callee.object.property.name === "logger"
    );
  }
}

export const strykerPlugins = [
  declareValuePlugin(PluginKind.Ignore, "logging", new LoggingIgnorer()),
];
