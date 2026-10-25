/// <reference types="jest" />
import { fireEvent, render, screen } from '@testing-library/react-native';
import { AppButton, AppCheckbox, AppUsageCard } from '@/components';
import { AppPermissionCard } from '@/components/states';
import { ThemeProvider } from '@/theme/ThemeProvider';

const wrap = (ui: React.ReactElement) => render(<ThemeProvider preference="dark">{ui}</ThemeProvider>);

describe('design system', () => {
  it('AppButton dispara onPress e respeita disabled', async () => {
    const onPress = jest.fn();
    await wrap(<AppButton label="Começar" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Começar' }));
    expect(onPress).toHaveBeenCalledTimes(1);

    const blocked = jest.fn();
    await wrap(<AppButton label="Bloqueado" onPress={blocked} disabled />);
    await fireEvent.press(screen.getByRole('button', { name: 'Bloqueado' }));
    expect(blocked).not.toHaveBeenCalled();
  });

  it('AppCheckbox é acessível e alterna', async () => {
    const onChange = jest.fn();
    await wrap(<AppCheckbox checked={false} onChange={onChange} accessibilityLabel="Evitar apostas" />);
    const box = screen.getByRole('checkbox', { name: 'Evitar apostas' });
    expect(box.props.accessibilityState.checked).toBe(false);
    await fireEvent.press(box);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('AppUsageCard mostra «18 / 30 min» com dados reais', async () => {
    await wrap(<AppUsageCard appId="instagram" name="Instagram" usedMin={18} limitMin={30} state="AVAILABLE" />);
    expect(screen.getByText('18 / 30 min')).toBeTruthy();
  });

  it('AppUsageCard nunca inventa minutos sem permissão', async () => {
    await wrap(<AppUsageCard appId="tiktok" name="TikTok" usedMin={null} limitMin={20} state="PERMISSION_REQUIRED" />);
    expect(screen.getByText('— / 20 min')).toBeTruthy();
    expect(screen.getByText('Sem permissão')).toBeTruthy();
  });

  it('AppPermissionCard só oferece acção quando a permissão está pendente', async () => {
    const req = jest.fn();
    const { rerender } = await wrap(<AppPermissionCard icon="activity" title="Uso das apps" description="x" state="denied" onRequest={req} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Activar' }));
    expect(req).toHaveBeenCalled();
    await rerender(
      <ThemeProvider preference="dark">
        <AppPermissionCard icon="activity" title="Uso das apps" description="x" state="granted" onRequest={req} />
      </ThemeProvider>,
    );
    expect(screen.queryByRole('button', { name: 'Activar' })).toBeNull();
    expect(screen.getByText('Concedida')).toBeTruthy();
  });
});
