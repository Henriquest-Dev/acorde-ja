// Reanimated 4 e Gesture Handler: implementações de teste (sem runtime nativo).
require('react-native-gesture-handler/jestSetup');
require('react-native-reanimated').setUpTests();
// O GH tenta ligar-se ao runtime UI dos worklets, que não existe em Jest.
jest.mock('react-native-worklets', () => ({
  ...jest.requireActual('react-native-worklets'),
  getUIRuntimeHolder: () => ({}),
}));
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  NotificationFeedbackType: {},
}));
// Ícones: componentes simples (evita carregar ficheiros de fonte nos testes).
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  const Icon = ({ name }) => require('react').createElement(Text, null, `[${name}]`);
  return new Proxy({}, { get: () => Icon });
});
