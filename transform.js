var j;
// 将 a||b 运算符转换为if(!a) b语句
const transOr = (path) => {
  const parentType = path.parentPath.node.type;
  if (parentType !== "VariableDeclaration") {
    const { left, right } = path.node.expression;
    let expressions;
    if (path.node.expression.right.type === "SequenceExpression") {
      expressions = transSequenceExpression(right, false);
    } else {
      expressions = [removeParentheses(right) || j.expressionStatement(right)];
    }
    const ifStatement = j.ifStatement(
      j.unaryExpression("!", left),
      j.blockStatement(expressions)
    );
    j(path).replaceWith(ifStatement);
  }
}; // end TranOr

// 将 a && b 运算符转换为if(a) b语句
const transAnd = (path) => {
  const parentType = path.parentPath.node.type;
  if (parentType !== "VariableDeclaration") {
    const { left, right } = path.node.expression;
    let expressions;
    if (path.node.expression.right.type === "SequenceExpression") {
      expressions = transSequenceExpression(right, false);
    } else {
      expressions = [j.expressionStatement(right)];
    }
    const ifStatement = j.ifStatement(left, j.blockStatement(expressions));
    j(path).replaceWith(ifStatement);
  }
}; // end transAnd

// 三目运算符转换为if语句
const transTernary = (path) => {
  const parentType = path.parentPath.node.type;
  if (parentType !== "VariableDeclaration") {
    const { test, consequent, alternate } = path.node.expression;
    if (consequent && alternate) {
      const consequent2 = getBlockStatement(consequent);
      const alternate2 = getBlockStatement(alternate);

      const ifStatement = j.ifStatement(test, consequent2, alternate2);
      j(path).replaceWith(ifStatement);
    }
  }
};

// 将逗号表达式转换为多个表达式
const transSequenceExpression = (expression, needCondition = true) => {
  const n = expression.expressions.length - 1;
  return expression.expressions.map((expression, i) => {
    if (i === n && needCondition) {
      return expression;
    }
    return j.expressionStatement(expression);
  });
};

// 删除括号
const removeParentheses = (node) => {
  let { expression } = node;
  if (!expression) {
    expression = node;
  }
  if (expression.type === j.AssignmentExpression.name) {
    const a = j.assignmentExpression(
      // 去掉括号
      expression.operator,
      expression.left,
      expression.right
    );
    return j.expressionStatement(a);
  } else if (expression.type === j.LogicalExpression.name) {
    const a = j.logicalExpression(
      // 去掉括号
      expression.operator,
      expression.left,
      expression.right
    );
    return j.expressionStatement(a);
  }
};

function getBlockStatement(node) {
  if (!node) {
    return null;
  }
  if (node.type === "BlockStatement") {
    return node;
  } else if (node.type === "SequenceExpression") {
    return j.blockStatement(transSequenceExpression(node, false));
  } else if (
    node.type === "CallExpression" ||
    node.type === "AssignmentExpression" ||
    node.type === "LogicalExpression" ||
    node.type === "ConditionalExpression" ||
    node.type === "UnaryExpression" ||
    node.type === "AwaitExpression" ||
    node.type === "UpdateExpression" ||
    node.type === "NewExpression" ||
    node.type === "YieldExpression" ||
    node.type === "ArrowFunctionExpression" ||
    node.type === "MemberExpression"
  ) {
    return j.blockStatement([j.expressionStatement(node)]);
  }
  return j.blockStatement([node]);
}

module.exports = function (file, api) {
  j = api.jscodeshift;
  const root = j(file.source);
  root.find(j.Node);
  // if 语句添加语句块
  root.find(j.IfStatement).forEach((path) => {
    const node = path.node;

    if (node.consequent) {
      if (node.consequent.type !== "BlockStatement") {
        node.consequent = j.blockStatement([node.consequent]);
      }

      if (node.consequent.type === "BlockStatement") {
        node.consequent.body.forEach((statement) => {
          if (statement && statement.type === "IfStatement") {
            if (
              statement.consequent &&
              statement.consequent.type !== "BlockStatement"
            ) {
              statement.consequent = j.blockStatement([statement.consequent]);
            } else if (
              statement.alternate &&
              statement.alternate.type !== "BlockStatement"
            ) {
              statement.alternate = j.blockStatement([statement.alternate]);
            }
          }
        });
      }
    } // end consequent

    if (node.alternate) {
      if (node.alternate.type !== "BlockStatement") {
        node.alternate = j.blockStatement([node.alternate]);
      }

      if (node.alternate.type === "BlockStatement") {
        node.alternate.body.forEach((statement) => {
          if (statement && statement.type === "IfStatement") {
            if (
              statement.consequent &&
              statement.consequent.type !== "BlockStatement"
            ) {
              statement.consequent = j.blockStatement([statement.consequent]);
            } else if (
              statement.alternate &&
              statement.alternate.type !== "BlockStatement"
            ) {
              statement.alternate = j.blockStatement([statement.alternate]);
            }
          }
        });
      }
    } // end alternate
  });

  // for 语句添加语句块
  root.find(j.ForStatement).forEach((path) => {
    if(path.__childCache){
      j(path.__childCache.body).replaceWith(getBlockStatement(path.node.body));
    }
  });

  // do while 语句添加语句块
  root.find(j.DoWhileStatement).forEach((path) => {
    if(path.__childCache){
      j(path.__childCache.body).replaceWith(getBlockStatement(path.node.body));
    }
  });

  // while 语句添加语句块
  root.find(j.WhileStatement).forEach((path) => {
    if(path.__childCache){
      j(path.__childCache.body).replaceWith(getBlockStatement(path.node.body));
    }
  });

  // 定义变量, 展开
  root.find(j.VariableDeclaration).forEach((path) => {
    const { node } = path;
    if (path.parentPath.node.type === "ForStatement") {
      return;
    }
    if (node.declarations.length > 1) {
      const newDeclarations = node.declarations.map((declaration) => {
        return j.variableDeclaration(node.kind, [
          j.variableDeclarator(declaration.id, declaration.init),
        ]);
      });
      j(path).replaceWith(newDeclarations);
    }
  });

  // (a,b,c) -> a;b;c;
  // return (a,b,c); -> a;b; return c;
  // if (a,b,c){} -> a;b; if(c){}
  root.find(j.SequenceExpression).forEach((path) => {
    const parentType = path.parentPath.node.type;
    if (parentType === "ExpressionStatement") {
      if (path.parentPath.name === "body") {
        j(path.parentPath).replaceWith(getBlockStatement(path.node));
      } else {
        const expressions = transSequenceExpression(path.node, false);
        j(path.parentPath).replaceWith(expressions);
      }
    } else if (
      parentType === "ReturnStatement" ||
      parentType === "IfStatement"
    ) {
      const expressions = transSequenceExpression(path.node, true);
      j(path).replaceWith(expressions.pop());
      j(path.parentPath).insertBefore(expressions);
    }
  });

  // 去掉括号
  for (let i = 0; i <= 3; i++) {
    root.find(j.ExpressionStatement).forEach((path) => {
      const { expression } = path.node;
      if (j.SequenceExpression.check(expression)) {
        const expressions = transSequenceExpression(expression);
        expressions && j(path).replaceWith(expressions);
      } else if (expression.type === j.AssignmentExpression.name) {
        const a = j.assignmentExpression(
          // 去掉括号
          expression.operator,
          expression.left,
          expression.right
        );
        j(path).replaceWith(j.expressionStatement(a));
      } else if (expression.type === j.LogicalExpression.name) {
        const a = j.logicalExpression(
          // 去掉括号
          expression.operator,
          expression.left,
          expression.right
        );
        j(path).replaceWith(j.expressionStatement(a));

        if (expression.operator === "||") {
          transOr(path);
        } else if (expression.operator === "&&") {
          transAnd(path);
        }
      } else if (expression.type === j.ConditionalExpression.name) {
        transTernary(path);
      }
    });
  }

  root.find(j.UnaryExpression, { operator: "!" }).forEach((path) => {
    const argument = path.node.argument;
    if (
      argument.type === "Literal" &&
      (argument.value === 0 || argument.value === 1)
    ) {
      const newValue = argument.value === 0 ? true : false;
      j(path).replaceWith(j.literal(newValue));
    } else if (
      argument.type === "LogicalExpression" &&
      argument.operator === "&&" &&
      argument.right.operator === "!==" &&
      argument.left.operator === "!=="
    ) {
      const { left, right } = argument;
      if (
        right.left.operator === "void" &&
        left.left.raw === "null" &&
        left.right.type === "Identifier" &&
        right.right.type === "Identifier"
      ) {
        j(path).replaceWith(
          j.unaryExpression("!", j.identifier(left.right.name))
        );
      } else if (
        right.left.raw === "null" &&
        left.left.operator === "void" &&
        left.right.type === "Identifier" &&
        right.right.type === "Identifier"
      ) {
        j(path).replaceWith(
          j.unaryExpression("!", j.identifier(left.right.name))
        );
      }
    }
  });

  root
    .find(j.ReturnStatement, {
      argument: { operator: "void", argument: { type: "Literal" } },
    })
    .forEach((path) => {
      j(path).replaceWith(j.returnStatement(null));
    });
  return root.toSource();
};
