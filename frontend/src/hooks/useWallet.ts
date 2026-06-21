import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

export type WalletStatus = 'disconnected' | 'connecting' | 'connected' | 'wrong_network' | 'error';

export interface WalletState {
  status: WalletStatus;
  address: string | null;
  chainId: number | null;
  balance: string | null;
  error: string | null;
}

const EXPECTED_CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID ?? 31337);

function getProvider(): ethers.BrowserProvider | null {
  if (typeof window === 'undefined' || !window.ethereum) return null;
  return new ethers.BrowserProvider(window.ethereum);
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    status: 'disconnected',
    address: null,
    chainId: null,
    balance: null,
    error: null,
  });

  const updateState = (patch: Partial<WalletState>) =>
    setState((s) => ({ ...s, ...patch }));

  const checkNetwork = (chainId: number): boolean => chainId === EXPECTED_CHAIN_ID;

  const refreshBalance = useCallback(async (address: string) => {
    const provider = getProvider();
    if (!provider || !address) return;
    try {
      const bal = await provider.getBalance(address);
      updateState({ balance: parseFloat(ethers.formatEther(bal)).toFixed(4) });
    } catch { /* ignore */ }
  }, []);

  const connect = useCallback(async () => {
    const provider = getProvider();
    if (!provider) {
      updateState({ status: 'error', error: 'MetaMask não encontrada. Instale a extensão MetaMask.' });
      return;
    }
    updateState({ status: 'connecting', error: null });
    try {
      const accounts: string[] = await provider.send('eth_requestAccounts', []);
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);
      const address = accounts[0];
      const isCorrectNetwork = checkNetwork(chainId);
      await refreshBalance(address);
      updateState({
        status: isCorrectNetwork ? 'connected' : 'wrong_network',
        address,
        chainId,
        error: isCorrectNetwork ? null : `Rede incorreta. Esperado chainId ${EXPECTED_CHAIN_ID}, obtido ${chainId}. Configure a MetaMask para a rede local Hardhat.`,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao conectar carteira';
      updateState({ status: 'error', error: msg });
    }
  }, [refreshBalance]);

  const disconnect = useCallback(() => {
    setState({ status: 'disconnected', address: null, chainId: null, balance: null, error: null });
  }, []);

  // Ouve eventos da MetaMask
  useEffect(() => {
    if (!window.ethereum) return;
    const eth = window.ethereum;

    const onAccountsChanged = (accounts: unknown) => {
      const list = accounts as string[];
      if (list.length === 0) {
        disconnect();
      } else {
        updateState({ address: list[0] });
        refreshBalance(list[0]);
      }
    };

    const onChainChanged = (chainIdHex: unknown) => {
      const chainId = parseInt(chainIdHex as string, 16);
      const isCorrectNetwork = checkNetwork(chainId);
      updateState({
        chainId,
        status: isCorrectNetwork ? 'connected' : 'wrong_network',
        error: isCorrectNetwork ? null : `Rede incorreta. Mude para chainId ${EXPECTED_CHAIN_ID} na MetaMask.`,
      });
    };

    eth.on('accountsChanged', onAccountsChanged);
    eth.on('chainChanged', onChainChanged);
    return () => {
      eth.removeListener?.('accountsChanged', onAccountsChanged);
      eth.removeListener?.('chainChanged', onChainChanged);
    };
  }, [disconnect, refreshBalance]);

  // Reconecta automaticamente se já aprovado anteriormente
  useEffect(() => {
    const provider = getProvider();
    if (!provider) return;
    provider.send('eth_accounts', []).then((accounts: string[]) => {
      if (accounts.length > 0) connect();
    }).catch(() => {/* sem acesso prévio */});
  }, [connect]);

  return { ...state, connect, disconnect };
}
