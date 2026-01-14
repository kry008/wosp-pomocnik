
function peselAnonimizuj(peselStr) {
  if (typeof peselStr !== 'string' || peselStr.length !== 11) {
    throw new Error("Nieprawidłowy numer PESEL");
  }
  var pesel = peselStr.split('');
  //pierwsza cyfra
  switch (pesel[9]) {
    case '0':
    case '1':
    case '2':
    case '3':
        var toReturn = pesel[0] + '##' + pesel[3] + '###' + pesel[7] + pesel[8] + '##';
        break;
    case '4':
    case '5':
    case '6':
    case '7':
        //##X##XX#X#
        var toReturn = '##' + pesel[2] + '##' + pesel[5] + pesel[6] + '#' + pesel[8] + '##';
        break;
    case '8':
    case '9':
        var toReturn = '###' + pesel[3] + '#'+pesel[5]+'#' + pesel[7] + pesel[8] + '##';
        break;
  
    default:
        var toReturn = '###########';
        break;
  }
    return toReturn;
}

//zwraca true jeżeli osoba jest pełnoletnia na dzień podany w argumencie dateObj
function czyPelnoletni(peselStr, dateObj) {
    if (typeof peselStr !== 'string' || peselStr.length !== 11) {
        throw new Error("Nieprawidłowy numer PESEL");
    }
    if (peselStr = "00000000000") {
        return true;
    }
    const yearPart = parseInt(peselStr.substring(0, 2), 10);
    let monthPart = parseInt(peselStr.substring(2, 4), 10);
    const dayPart = parseInt(peselStr.substring(4, 6), 10);

    let fullYear;
    if (monthPart >= 1 && monthPart <= 12) {
        fullYear = 1900 + yearPart;
    } else if (monthPart >= 21 && monthPart <= 32) {
        fullYear = 2000 + yearPart;
        monthPart -= 20;
    } else if (monthPart >= 41 && monthPart <= 52) {
        fullYear = 2100 + yearPart;
        monthPart -= 40;
    } else if (monthPart >= 61 && monthPart <= 72) {
        fullYear = 2200 + yearPart;
        monthPart -= 60;
    } else if (monthPart >= 81 && monthPart <= 92) {
        fullYear = 1800 + yearPart;
        monthPart -= 80;
    } else {
        throw new Error("Nieprawidłowy numer PESEL");
    }
    
    const birthDate = new Date(fullYear, monthPart - 1, dayPart);
    const adultDate = new Date(birthDate.getFullYear() + 18, birthDate.getMonth(), birthDate.getDate());
    return dateObj >= adultDate;
}

//sprawdza czy PESEL jest poprawny (długość, cyfry, suma kontrolna)
function czyPoprawnyPesel(peselStr) {
    if (typeof peselStr !== 'string' || peselStr.length !== 11) {
        return false;
    }
    // sprawdź czy wszystkie znaki to cyfry
    if (!/^\d{11}$/.test(peselStr)) {
        return false;
    }
    // suma kontrolna
    const weights = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
    let sum = 0;
    for (let i = 0; i < 10; i++) {
        sum += parseInt(peselStr[i]) * weights[i];
    }
    const controlDigit = (10 - (sum % 10)) % 10;
    return parseInt(peselStr[10]) === controlDigit;
}


export { peselAnonimizuj, czyPelnoletni, czyPoprawnyPesel };