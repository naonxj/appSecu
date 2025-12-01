declare module 'react-native-sqlite-storage' {
  export function openDatabase(params: any, success?: () => void, error?: (e: any) => void): any;
  // 필요한 경우 추가 타입 정의 가능
}