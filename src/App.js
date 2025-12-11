import { useEffect, useState } from 'react';
import { ethers } from 'ethers';

// Components
import Navigation from './components/Navigation';
import Search from './components/Search';
import Home from './components/Home';

// ABIs
import RealEstate from './abis/RealEstate.json'
import Escrow from './abis/Escrow.json'

// Config
import config from './config.json';

function App() {

  const [provider, setProvider] = useState(null);

  const [escrow, setEscrow] = useState(null);

  const [account, setAccount] = useState(null);

  const [homes, setHomes] = useState([]);

  const loadBlockchainData = async () => {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    setProvider(provider);

    const network = await provider.getNetwork();
    console.log('Detected network:', network);
    let chainIdStr = network.chainId.toString();

    let deployment = config[chainIdStr];
    if (!deployment) {
      console.error(`No contract addresses configured for chainId ${chainIdStr}. Update src/config.json or switch to the correct network.`);
      return;
    }

    // RealEstate
    const realEstateAddress = deployment.realEstate?.address;
    if (!realEstateAddress) {
      console.error(`Missing realEstate.address for chainId ${chainIdStr} in src/config.json.`);
      return;
    }
    const realEstateCode = await provider.getCode(realEstateAddress);
    if (realEstateCode === '0x') {
      console.error(`No contract code found at ${realEstateAddress} on chainId ${chainIdStr}. Make sure RealEstate is deployed and config.json is updated.`);
      return;
    }
    const realEstate = new ethers.Contract(
      realEstateAddress,
      RealEstate,
      provider
    );

    
     const totalSupply = await realEstate.totalSupply();
      console.log('Total supply:', totalSupply);
   
    const homes = [];
    for (var i = 1 ; i <= totalSupply; i++) {
      const uri = await realEstate.tokenURI(i);
      console.log(uri);
      // const response = await fetch(uri);
      // const metadata = await response.json();
      // homes.push(metadata);
    }

    setHomes(homes);
    console.log(homes)

    // Escrow
    const escrowAddress = deployment.escrow?.address;
    if (!escrowAddress) {
      console.error(`Missing escrow.address for chainId ${chainIdStr} in src/config.json.`);
      return;
    }
    const escrowCode = await provider.getCode(escrowAddress);
    if (escrowCode === '0x') {
      console.error(`No contract code found at ${escrowAddress} on chainId ${chainIdStr}. Make sure Escrow is deployed to this network and config.json is updated.`);
      return;
    }
    const escrow = new ethers.Contract(
      escrowAddress,
      Escrow,
      provider
    );
    setEscrow(escrow);

    window.ethereum.on('accountsChanged', async () => {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const account = (accounts && accounts.length) ? ethers.utils.getAddress(accounts[0]) : null;
        setAccount(account);
    });
  }

  useEffect(() => {
    loadBlockchainData();
  }, []);

  return (
    <div>

      <Navigation account={account} setAccount={setAccount} />
      <Search />

      <div className='cards__section'>

        <h3>Assets for you</h3>

        <hr />

        <div className='cards__containers'>
          <div className='card'>
            {homes.map((home, index) => (
              <div className='card__image' key={index}>
                <img src={home} alt='Property' />
              </div>
            ))}
            <div className='card__info'>
              <h4>Property 1</h4>
              <p>Location: Jakarta, Indonesia</p>
              <p>Price: 10 ETH</p>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}

export default App;
