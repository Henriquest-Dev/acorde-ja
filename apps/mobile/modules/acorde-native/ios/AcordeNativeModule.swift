import ExpoModulesCore
import FamilyControls
import ManagedSettings
import SwiftUI
import UIKit

/// Integração com as APIs Screen Time da Apple.
///
/// Limitações impostas pela Apple (ver docs/ios.md):
/// - O aplicativo NÃO pode ler tempos de utilização numéricos. Os relatórios
///   só podem ser apresentados por uma extensão DeviceActivityReport.
/// - As aplicações são escolhidas pelo utilizador no FamilyActivityPicker e
///   identificadas por tokens opacos (sem nomes nem bundle ids).
/// - Limites com contagem de tempo exigem uma extensão DeviceActivityMonitor
///   (alvo separado) — planeado para a Fase 5.
/// - Requer o entitlement com.apple.developer.family-controls aprovado pela Apple.
public class AcordeNativeModule: Module {
  private let store = ManagedSettingsStore(named: ManagedSettingsStore.Name("acorde"))
  private let selectionKey = "acorde.familyActivitySelection"

  public func definition() -> ModuleDefinition {
    Name("AcordeNative")

    AsyncFunction("getNativeCapabilities") { () -> [String: Any] in
      let authorized = AuthorizationCenter.shared.authorizationStatus == .approved
      return [
        "platform": "ios",
        "canMeasureUsage": false,
        "canRestrictApps": authorized,
        "canBlockSites": authorized,
        "canListInstalledApps": false,
        "enforcementRunning": authorized && !(self.store.shield.applications?.isEmpty ?? true),
        "shieldRunning": authorized && self.store.webContent.blockedByFilter != nil,
        "osVersion": "iOS \(UIDevice.current.systemVersion)",
        "notes": [
          "No iOS, a Apple não permite que o aplicativo leia os minutos de utilização de cada aplicação.",
          "As aplicações a limitar são escolhidas por si no selector do Tempo de Ecrã.",
        ],
      ]
    }

    AsyncFunction("getPermissionStatus") { () -> [String: String] in
      let status: String
      switch AuthorizationCenter.shared.authorizationStatus {
      case .approved: status = "granted"
      case .denied: status = "denied"
      default: status = "not_determined"
      }
      return [
        "usageAccess": status,
        "overlay": "unsupported",
        "notifications": "not_determined",
        "vpn": "unsupported",
        "familyControls": status,
      ]
    }

    AsyncFunction("requestFamilyControlsAuthorization") { (promise: Promise) in
      Task {
        do {
          try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
          promise.resolve("granted")
        } catch {
          promise.resolve(AuthorizationCenter.shared.authorizationStatus == .denied ? "denied" : "not_determined")
        }
      }
    }

    AsyncFunction("requestUsagePermission") { (promise: Promise) in
      Task {
        do {
          try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
        } catch {}
        promise.resolve(nil)
      }
    }

    /// Mostra o FamilyActivityPicker e guarda a selecção. Devolve o nº de itens escolhidos.
    AsyncFunction("presentAppPicker") { (promise: Promise) in
      DispatchQueue.main.async {
        guard let root = UIApplication.shared.connectedScenes
          .compactMap({ ($0 as? UIWindowScene)?.keyWindow?.rootViewController }).first else {
          promise.reject("ERR_UNSUPPORTED", "Sem janela activa para apresentar o selector")
          return
        }
        var selection = self.loadSelection()
        let host = UIHostingController(rootView: PickerView(selection: Binding(get: { selection }, set: { selection = $0 })) {
          self.saveSelection(selection)
          root.dismiss(animated: true)
          promise.resolve(selection.applicationTokens.count + selection.categoryTokens.count + selection.webDomainTokens.count)
        })
        root.present(host, animated: true)
      }
    }

    /// Aplica imediatamente o escudo às aplicações seleccionadas (modo foco / horários).
    AsyncFunction("startEnforcement") { () -> Bool in
      guard AuthorizationCenter.shared.authorizationStatus == .approved else {
        throw FamilyControlsException()
      }
      let selection = self.loadSelection()
      self.store.shield.applications = selection.applicationTokens.isEmpty ? nil : selection.applicationTokens
      self.store.shield.applicationCategories = selection.categoryTokens.isEmpty
        ? nil : ShieldSettings.ActivityCategoryPolicy.specific(selection.categoryTokens)
      self.store.shield.webDomains = selection.webDomainTokens.isEmpty ? nil : selection.webDomainTokens
      return true
    }

    AsyncFunction("stopEnforcement") {
      self.store.shield.applications = nil
      self.store.shield.applicationCategories = nil
      self.store.shield.webDomains = nil
    }

    /// Filtro de conteúdo adulto do sistema + domínios personalizados.
    AsyncFunction("startShield") { (domains: [String], _: String) -> Bool in
      guard AuthorizationCenter.shared.authorizationStatus == .approved else {
        throw FamilyControlsException()
      }
      let blocked = Set(domains.prefix(50).map { WebDomain(domain: $0) })
      self.store.webContent.blockedByFilter = .auto(blocked)
      return true
    }

    AsyncFunction("stopShield") {
      self.store.webContent.blockedByFilter = nil
    }

    AsyncFunction("prepareShield") { () -> Bool in
      AuthorizationCenter.shared.authorizationStatus == .approved
    }

    AsyncFunction("getShieldStats") { () -> [String: Any?] in
      [
        "running": self.store.webContent.blockedByFilter != nil,
        "blockedToday": 0,
        "domains": 0,
        "lastError": nil,
      ]
    }

    // Funções sem equivalente no iOS: respondem de forma explícita.
    AsyncFunction("requestOverlayPermission") {}
    AsyncFunction("openSystemSettings") { (_: String) in
      if let url = URL(string: UIApplication.openSettingsURLString) {
        DispatchQueue.main.async { UIApplication.shared.open(url) }
      }
    }
    AsyncFunction("getInstalledApps") { () -> [[String: Any]] in [] }
    AsyncFunction("getUsageStats") { (_: Double, _: Double) throws -> [String: Any] in
      throw UnsupportedException("A Apple não disponibiliza tempos de utilização ao aplicativo.")
    }
    AsyncFunction("setRuleConfig") { (_: String) in }
    AsyncFunction("setAppLimit") { (_: String, _: [String], _: Int, _: Bool) in }
    AsyncFunction("getAppLimit") { (_: String) -> [String: Any]? in nil }
    AsyncFunction("removeAppLimit") { (_: String) in }
    AsyncFunction("getRestrictionStatus") { () -> [[String: Any]] in [] }
    AsyncFunction("drainEvents") { () -> String in "[]" }
    AsyncFunction("goHome") {}
  }

  private func loadSelection() -> FamilyActivitySelection {
    guard let data = UserDefaults.standard.data(forKey: selectionKey),
          let selection = try? PropertyListDecoder().decode(FamilyActivitySelection.self, from: data) else {
      return FamilyActivitySelection()
    }
    return selection
  }

  private func saveSelection(_ selection: FamilyActivitySelection) {
    if let data = try? PropertyListEncoder().encode(selection) {
      UserDefaults.standard.set(data, forKey: selectionKey)
    }
  }
}

private struct PickerView: View {
  @Binding var selection: FamilyActivitySelection
  let onDone: () -> Void

  var body: some View {
    NavigationView {
      FamilyActivityPicker(selection: $selection)
        .navigationTitle("Escolher aplicações")
        .toolbar {
          ToolbarItem(placement: .confirmationAction) {
            Button("Concluir", action: onDone)
          }
        }
    }
    .preferredColorScheme(.dark)
  }
}

final class FamilyControlsException: Exception {
  override var code: String { "ERR_FAMILY_CONTROLS" }
  override var reason: String { "Autorização do Tempo de Ecrã não concedida." }
}

final class UnsupportedException: GenericException<String> {
  override var code: String { "ERR_UNSUPPORTED" }
  override var reason: String { param }
}
