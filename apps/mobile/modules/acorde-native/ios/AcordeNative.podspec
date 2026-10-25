Pod::Spec.new do |s|
  s.name           = 'AcordeNative'
  s.version        = '0.1.0'
  s.summary        = 'Integração Screen Time (FamilyControls / ManagedSettings) do Acorde Já'
  s.description    = 'Autorização FamilyControls, selecção de aplicações e restrições ManagedSettings.'
  s.license        = 'UNLICENSED'
  s.author         = 'Acorde Já'
  s.homepage       = 'https://acordeja.pt'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'FamilyControls', 'ManagedSettings', 'DeviceActivity'
  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
