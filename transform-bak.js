var j;
// 将 a||b 运算符转换为if(!a) b语句
const transOr = (path) => {
  const parentType = path.parentPath.node.type;
  if (parentType !== "VariableDeclaration") {
    const { left, right } = path.node.expression;
    let expressions;
    if (path.node.expression.right.type === "SequenceExpression") {
      expressions = transSequenceExpression(right);
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
      expressions = transSequenceExpression(right);
    } else {
      expressions = [removeParentheses(right) || j.expressionStatement(right)];
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
      try {
        const consequent2 = j.blockStatement([
          removeParentheses(consequent) || j.expressionStatement(consequent),
        ]);
        const alternate2 = j.blockStatement([
          removeParentheses(alternate) || j.expressionStatement(alternate),
        ]);

        const ifStatement = j.ifStatement(test, consequent2, alternate2);
        j(path).replaceWith(ifStatement);
      } catch (e) {
        debugger;
      }
    }
  }
};

// 将逗号表达式转换为多个表达式
const transSequenceExpression = (expression) => {
  return expression.expressions.map((expression) => {
    return removeParentheses(expression) || j.expressionStatement(expression);
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

const myDeal = (root) => {
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
}; // end mydeal

function splitVariableDeclaration(file, api) {
  j = api.jscodeshift;
  const root = j(file.source);
  const programNode = root.find(j.Program).get(0).node;
  // 变量声明展开
  root.find(j.VariableDeclaration).forEach((path) => {
    const { node } = path;
    if (node.declarations.length > 1) {
      const newDeclarations = node.declarations.map((declaration) => {
        return j.variableDeclaration(node.kind, [
          j.variableDeclarator(declaration.id, declaration.init),
        ]);
      });
      j(path).replaceWith(newDeclarations);
    }
  });

  // !0 -> true, !1 -> false
  root.find(j.UnaryExpression, { operator: "!" }).forEach((path) => {
    const { argument } = path.node;
    if (
      argument.type === "Literal" &&
      (argument.value === 0 || argument.value === 1)
    ) {
      const newValue = argument.value === 0 ? true : false;
      j(path).replaceWith(j.literal(newValue));
    }
  });

  root
    .find(j.ReturnStatement)
    .forEach((path) => {
      const { argument } = path.node;
      if(!argument){
        return;
      }
      // 判断是否是void 0
      if(argument.type === 'UnaryExpression' && argument.operator === 'void'){
        j(path).replaceWith(j.returnStatement(null));
      }else if(argument.expressions && argument.expressions.length>=2){
        const expressions = argument.expressions
        const lastIdx = expressions.length - 1;
        const statements = expressions.map((expression, i) => {
          if (i === lastIdx) {
            return j.returnStatement(expression);
          }
          return j.expressionStatement(expression);
        });
  
        // 判断parentPath是否为IfStatement
        const parentType = path.parentPath.node.type;
        if (parentType === "IfStatement" || parentType === "ForStatement") {
          j(path).replaceWith(j.blockStatement(statements));
        }else{
          j(path).replaceWith(statements);
        }
      }
    });

  myDeal(root);
  myDeal(root);
  myDeal(root);
  myDeal(root);
  return root.toSource();
}
// Identifier
module.exports = splitVariableDeclaration;
