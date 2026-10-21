import { DadDataApi } from '../../preload/index';

declare global {
  interface Window {
    api: DadDataApi;
  }
}
