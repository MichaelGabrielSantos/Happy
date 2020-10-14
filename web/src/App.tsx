import React from 'react';

import {FiArrowRight} from 'react-icons/fi'

import './styles/global.css'
import './styles/pages/landing.css'

import Logo from './images/Logo.svg'

function App() {
  return (
    <div id="page-landing">
     <div className="content-wrapper">
      <img src={Logo} alt="Happy"></img>

      <main>
        <h1>Leve felicidade para o mundo
          <p>Visite orfanatos e mude o dia de muitas crianças </p>
        </h1>
      </main>

      <div className="location">
        <strong>São Paulo</strong>
        <span>Mauá </span>
      </div>

      <a href="" className="enter-app">
        <FiArrowRight size={26} color="rgba(0,0,0,0.6)"></FiArrowRight>
      </a>
     </div>
    </div>
  );
}

export default App;
