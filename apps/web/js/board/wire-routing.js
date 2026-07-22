export function routeWire({ fromTerminal, toTerminal, from, to, terminalDefinition, componentById, components }) {
  const fromExit = terminalExitPoint(from, terminalDefinition(fromTerminal)?.side, to);
  const toExit = terminalExitPoint(to, terminalDefinition(toTerminal)?.side, from);
  const routeContext = { componentById, components };
  const candidates = [
    [from, fromExit, { x: toExit.x, y: fromExit.y }, toExit, to],
    [from, fromExit, { x: fromExit.x, y: toExit.y }, toExit, to],
    [
      from,
      fromExit,
      { x: (fromExit.x + toExit.x) / 2, y: fromExit.y },
      { x: (fromExit.x + toExit.x) / 2, y: toExit.y },
      toExit,
      to
    ],
    [
      from,
      fromExit,
      { x: fromExit.x, y: (fromExit.y + toExit.y) / 2 },
      { x: toExit.x, y: (fromExit.y + toExit.y) / 2 },
      toExit,
      to
    ]
  ];
  const compactPoints = candidates
    .map(compactRoutePoints)
    .sort((left, right) => scoreRoute(left, fromTerminal, toTerminal, routeContext) - scoreRoute(right, fromTerminal, toTerminal, routeContext))[0];

  return {
    d: compactPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' '),
    midpoint: compactPoints[Math.floor(compactPoints.length / 2)]
  };
}

function terminalExitPoint(point, side, target) {
  const offset = 48;
  const dx = target.x - point.x;
  const dy = target.y - point.y;
  const horizontalDominant = Math.abs(dx) > Math.abs(dy) * 1.2;
  const verticalDominant = Math.abs(dy) > Math.abs(dx) * 1.2;

  if (side === 'top' && (dy > 0 || horizontalDominant)) {
    return horizontalEscapePoint(point, dx, offset);
  }

  if (side === 'bottom' && (dy < 0 || horizontalDominant)) {
    return horizontalEscapePoint(point, dx, offset);
  }

  if (side === 'left' && (dx > 0 || verticalDominant)) {
    return verticalEscapePoint(point, dy, offset);
  }

  if (side === 'right' && (dx < 0 || verticalDominant)) {
    return verticalEscapePoint(point, dy, offset);
  }

  if (side === 'left') {
    return { x: point.x - offset, y: point.y };
  }

  if (side === 'right') {
    return { x: point.x + offset, y: point.y };
  }

  if (side === 'top') {
    return { x: point.x, y: point.y - offset };
  }

  if (side === 'bottom') {
    return { x: point.x, y: point.y + offset };
  }

  return { ...point };
}

function horizontalEscapePoint(point, dx, offset) {
  return {
    x: point.x + (dx < 0 ? -offset : offset),
    y: point.y
  };
}

function verticalEscapePoint(point, dy, offset) {
  return {
    x: point.x,
    y: point.y + (dy < 0 ? -offset : offset)
  };
}

function compactRoutePoints(points) {
  return points.filter((point, index) => {
    const previous = points[index - 1];
    const next = points[index + 1];
    const duplicate = previous && previous.x === point.x && previous.y === point.y;
    const collinear = previous && next
      && (previous.x === point.x && point.x === next.x || previous.y === point.y && point.y === next.y);

    return !duplicate && !collinear;
  });
}

function scoreRoute(points, fromTerminal, toTerminal, routeContext) {
  const length = routeLength(points);
  const bends = Math.max(points.length - 2, 0);
  const crossings = routeComponentCrossings(points, fromTerminal.componentId, toTerminal.componentId, routeContext);
  const nearEdges = routeEndpointComponentNearEdges(points, fromTerminal.componentId, toTerminal.componentId, routeContext);

  return length + bends * 18 + nearEdges * 160 + crossings * 10000;
}

function routeLength(points) {
  return points.slice(1).reduce((total, point, index) => {
    const previous = points[index];
    return total + Math.abs(point.x - previous.x) + Math.abs(point.y - previous.y);
  }, 0);
}

function routeComponentCrossings(points, fromComponentId, toComponentId, routeContext) {
  let crossings = 0;

  for (const component of routeContext.components()) {
    if (component.id === fromComponentId || component.id === toComponentId) {
      continue;
    }

    const bounds = componentBounds(component, 8);

    for (let index = 1; index < points.length; index += 1) {
      if (segmentIntersectsBounds(points[index - 1], points[index], bounds)) {
        crossings += 1;
      }
    }
  }

  return crossings;
}

function routeEndpointComponentNearEdges(points, fromComponentId, toComponentId, routeContext) {
  return [fromComponentId, toComponentId].reduce((total, componentId) => {
    const component = routeContext.componentById(componentId);

    if (!component) {
      return total;
    }

    const bounds = componentBounds(component, 16);
    const innerBounds = componentBounds(component, -2);

    return total + points.slice(1, -1).filter((point) => {
      return point.x >= bounds.left && point.x <= bounds.right
        && point.y >= bounds.top && point.y <= bounds.bottom
        && !(point.x > innerBounds.left && point.x < innerBounds.right && point.y > innerBounds.top && point.y < innerBounds.bottom);
    }).length;
  }, 0);
}

function componentBounds(component, padding = 0) {
  return {
    left: component.x - padding,
    right: component.x + component.element.offsetWidth + padding,
    top: component.y - padding,
    bottom: component.y + component.element.offsetHeight + padding
  };
}

function segmentIntersectsBounds(start, end, bounds) {
  if (start.x === end.x) {
    const y1 = Math.min(start.y, end.y);
    const y2 = Math.max(start.y, end.y);
    return start.x >= bounds.left && start.x <= bounds.right && y2 >= bounds.top && y1 <= bounds.bottom;
  }

  if (start.y === end.y) {
    const x1 = Math.min(start.x, end.x);
    const x2 = Math.max(start.x, end.x);
    return start.y >= bounds.top && start.y <= bounds.bottom && x2 >= bounds.left && x1 <= bounds.right;
  }

  return false;
}
