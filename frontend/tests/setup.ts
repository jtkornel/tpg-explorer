import '@testing-library/jest-dom';

// Mock getBoundingClientRect and client dimensions for jsdom
if (typeof Element !== 'undefined') {
  Element.prototype.getBoundingClientRect = function () {
    return {
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      bottom: 600,
      right: 800,
      x: 0,
      y: 0,
      toJSON: () => {},
    };
  };

  Object.defineProperty(Element.prototype, 'clientWidth', {
    configurable: true,
    value: 800,
  });
  Object.defineProperty(Element.prototype, 'clientHeight', {
    configurable: true,
    value: 600,
  });
}

// Mock window.getComputedStyle padding properties so cytoscape cy.width() calculates a valid number
if (typeof window !== 'undefined') {
  const origGetComputedStyle = window.getComputedStyle;
  window.getComputedStyle = function (elt, pseudoElt) {
    const style = origGetComputedStyle ? origGetComputedStyle.call(window, elt, pseudoElt) : ({} as CSSStyleDeclaration);
    const origGetPropertyValue = style.getPropertyValue ? style.getPropertyValue.bind(style) : () => '';
    style.getPropertyValue = function (prop: string) {
      if (
        prop === 'padding-left' ||
        prop === 'padding-right' ||
        prop === 'padding-top' ||
        prop === 'padding-bottom'
      ) {
        return '0px';
      }
      return origGetPropertyValue(prop);
    };
    return style;
  };
}

// Mock HTMLCanvasElement.prototype.getContext for jsdom environments (Cytoscape uses canvas)
if (typeof HTMLCanvasElement !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (HTMLCanvasElement.prototype as any).getContext = function () {
    return {
      fillRect: () => {},
      clearRect: () => {},
      getImageData: (_x: number, _y: number, w: number, h: number) => ({
        data: new Array(w * h * 4).fill(0),
      }),
      putImageData: () => {},
      createImageData: () => [],
      setTransform: () => {},
      drawImage: () => {},
      save: () => {},
      fillText: () => {},
      restore: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
      stroke: () => {},
      translate: () => {},
      scale: () => {},
      rotate: () => {},
      arc: () => {},
      fill: () => {},
      measureText: () => ({ width: 0 }),
      transform: () => {},
      rect: () => {},
      clip: () => {},
    };
  };
}

