import {pickBy} from './utils/utils';
import {wixStylesFontUtils} from './utils/wixStyleFontUtils';
import {wixStylesColorUtils} from './utils/wixStylesColorUtils';
import {IS_RTL_PARAM} from './constants';
import {IOptions, ISiteColor, ISiteTextPreset, IStyleFont, IStyleParams} from './types';

export interface ITPAParams {
  colors: {[index: string]: {value: string}};
  numbers: {[index: string]: number};
  booleans: {[index: string]: boolean};
  fonts: Object;
  strings: Object;
}

export function generateTPAParams(
  siteColors: ISiteColor[],
  siteTextPresets: ISiteTextPreset,
  styleParams: IStyleParams,
  options: Partial<IOptions>
): ITPAParams {
  const colorStyles = styleParams.colors;
  const fontStyles = pickBy<IStyleFont>(styleParams.fonts, wixStylesFontUtils.isValidFontParam);

  const numbers = styleParams.numbers || {};
  const colors = wixStylesColorUtils.getFullColorStyles({colorStyles, siteColors}) || {};
  const fonts = wixStylesFontUtils.getFullFontStyles({fontStyles, siteTextPresets}) || {};
  const strings = pickBy(styleParams.fonts, wixStylesFontUtils.isStringHack);
  const booleans = {...styleParams.booleans, [IS_RTL_PARAM]: options.isRTL};
  return {colors, fonts, numbers, strings, booleans};
}
