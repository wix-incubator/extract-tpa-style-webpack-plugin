import {cssFunctions} from '../../src/runtime/cssFunctions';
import {siteTextPresets} from '../fixtures/siteTextPresets';
import {IS_RTL_PARAM} from '../../src/runtime/constants';
import {ITPAParams} from '../../src/runtime/generateTPAParams';

describe('cssFunctions', () => {
  describe('join', () => {
    it('should join 2 colors', () => {
      const color1 = '#ff0000';
      const color2 = '#00ff00';

      expect(cssFunctions.join(color1, 0, color2, 0)).toBe('rgb(255, 255, 0)');
    });

    it('should join 2 colors with alpha', () => {
      const color1 = 'rgba(255,0,0,.5)';
      const color2 = 'rgba(0,255,0,.5)';

      expect(cssFunctions.join(color1, 0, color2, 0)).toBe('rgba(255, 255, 0, 0.5)');
    });
  });

  describe('color', () => {
    it('should return css color', () => {
      expect(cssFunctions.color('red', {colors: {}} as any)).toBe('rgb(255, 0, 0)');
    });

    it('should return css color', () => {
      expect(cssFunctions.color({r: 255, g: 0, b: 0}, {colors: {}} as any)).toBe('rgb(255, 0, 0)');
    });

    it('should return color from tpaParams', () => {
      expect(cssFunctions.color('color-1', {colors: {['color-1']: 'rgb(255, 0, 0)'}} as any))
        .toBe('rgb(255, 0, 0)');
    });

    it('should return hex color', () => {
      expect(cssFunctions.color('#ff0000', {colors: {}} as any)).toBe('#ff0000');
    });

    it('should return empty string for no value', () => {
      expect(cssFunctions.color('', {colors: {}} as any)).toBe('');
      expect(cssFunctions.color(undefined, {colors: {}} as any)).toBe('');
      expect(cssFunctions.color(null, {colors: {}} as any)).toBe('');
    });

    it('should throw an exception when color not parsed', () => {
      expect(() => cssFunctions.color('rgb(bla)', {colors: {}} as any)).toThrowError();
    });
  });

  describe('opacity', () => {
    it('should add opacity', () => {
      expect(cssFunctions.opacity('red', 0.4)).toBe('rgba(255, 0, 0, 0.4)');
    });

    it('should add opacity', () => {
      expect(cssFunctions.opacity('rgba(255,0,0,.8)', 0.5)).toBe('rgba(255, 0, 0, 0.4)');
    });
  });

  describe('withoutOpacity', () => {
    it('should remove opacity', () => {
      expect(cssFunctions.withoutOpacity('rgba(255,0,0,.5)')).toBe('rgb(255, 0, 0)');
    });
  });

  describe('darken', () => {
    it('should add darken', () => {
      expect(cssFunctions.darken('rgb(255,255,255)', 0.5)).toBe('rgb(127, 127, 127)');
    });
    it('should add darken', () => {
      expect(cssFunctions.darken('rgb(255,0,0)', 0.5)).toBe('rgb(127, 0, 0)');
    });
  });

  describe('font', () => {
    it('should support font as an object', () => {
      const font = {
        size: '10',
        lineHeight: '1.4',
        style: 'italic',
        family: ['family', 'family2;'],
        weight: 'bold',
        variant: 'variant'
      };
      expect(cssFunctions.font(font, {} as any)).toBe('italic variant bold 10/1.4 family,family2');
    });

    it('should support tpa text preset', () => {
      const font = {
        size: '10',
        lineHeight: '1.4',
        style: 'italic',
        family: ['family', 'family2;'],
        weight: 'bold',
        variant: 'variant'
      };
      expect(cssFunctions.font('Body-M', {fonts: {['Body-M']: font}} as any))
        .toBe('italic variant bold 10/1.4 family,family2');
    });

    it('should support override tpa text preset', () => {
      const font = {
        size: '10',
        lineHeight: '1.4',
        style: 'italic',
        family: ['family', 'family2;'],
        weight: 'bold',
        variant: 'variant'
      };
      expect(cssFunctions.font(`{theme: 'Body-M', size: '20px', style:'normal', lineHeight: '1em'}`, {fonts: {['Body-M']: font}} as any))
        .toBe('normal variant bold 20px/1em family,family2');
    });

    it('should return given font', () => {
      expect(cssFunctions.font(`unknown-font`, {fonts: {}} as any)).toBe(`unknown-font`);
    });
  });

  describe('string', () => {
    it('should support string', () => {
      expect(cssFunctions.string('str')).toBe(`str`);
    });
  });

  describe('number', () => {
    it('should support number', () => {
      expect(cssFunctions.number('1')).toBe(1);
    });

    it('should always convert to number', () => {
      expect(cssFunctions.number('s')).toBe(NaN);
    });
  });

  describe('unit', () => {
    it('should add unit', () => {
      expect(cssFunctions.unit(10, 'px')).toBe(`10px`);
    });
  });

  describe('underline', () => {
    it('should support underline', () => {
      expect(cssFunctions.underline({underline: true})).toBe(`underline`);
    });

    it('should return empty str', () => {
      expect(cssFunctions.underline({})).toBe(``);
    });
  });

  describe('fallback', () => {
    it('should return the first none falsy', () => {
      expect(cssFunctions.fallback(0, '', false, undefined, 'abs', {})).toBe('abs');
    });
  });

  describe('direction', () => {
    const directionMap = {
      'START': {ltr: 'left', rtl: 'right'},
      'END': {ltr: 'right', rtl: 'left'},
      'STARTSIGN': {ltr: '-', rtl: ''},
      'ENDSIGN': {ltr: '', rtl: '-'},
      'DEG-START': {ltr: '0', rtl: '180'},
      'DEG-END': {ltr: '180', rtl: '0'},
      'DIR': {ltr: 'ltr', rtl: 'rtl'}
    };

    [false, true].forEach((isRtl) => {
      Object.keys(directionMap).forEach((directionKey) => {
        it(`should support ${directionKey}`, () => {
          expect(cssFunctions.direction(directionKey, {booleans: {[IS_RTL_PARAM]: isRtl}} as any))
            .toBe(directionMap[directionKey][isRtl ? 'rtl' : 'ltr'])
        });
      });
    });
  });
});