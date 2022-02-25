- run before tests:
Admin: tokenA: set balance (seller, 10000)
Admin: tokenA: set balance (buyer, 10000)
Admin: tokenB: set balance (seller, 10000)
Admin: tokenB: set balance (buyyer, 10000)

Seller: tokenA: approve (exchangeCA, 10000)
Buyer: tokenB: approve (exchangeCA, 10000)
Seller: tokenA: approve (exchangeCA, 10000)
Buyer: tokenB: approve (exchangeCA, 10000)


test case #1
initPVnode(50)
newSellOrder(50, 1, 0) from 0x5B3...C4
ETH, balanceOf(0x5B38Da6a701c568545dCfcB03FcB875f56beddC4) == 9999
USDb, balanceOf(0x5B38Da6a701c568545dCfcB03FcB875f56beddC4) == 10000
getPVobs(50) == ([[50,1]], [[50,0]])
getDeposits(0x5B38Da6a701c568545dCfcB03FcB875f56beddC4, 0xd9145CCE52D386f254917e481eB44e9943F39138) == 1
getDeposits(0x5B38Da6a701c568545dCfcB03FcB875f56beddC4, 0xd8b934580fcE35a11B58C6D73aDeE468a2833fa8) == 0
getAllSellOrders(50) == ([0x5B38Da6a701c568545dCfcB03FcB875f56beddC4, 1])
orderBook(0xd9145CCE52D386f254917e481eB44e9943F39138, 50) == len=1, head=<bytes32>, tail=<bytes32>
orderBook(0xd8b934580fcE35a11B58C6D73aDeE468a2833fa8, 50) == len=0, head=0, tail=0
activeSellOrders() == (<bytes32>)

newBuyOrder(50, 1, 0) from 0xAb8...b2
ETH, balanceOf(0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2) == 10001
USDb, balanceOf(0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2) == 9950
ETH, balanceOf(0x5B38Da6a701c568545dCfcB03FcB875f56beddC4) == 9999
USDb, balanceOf(0x5B38Da6a701c568545dCfcB03FcB875f56beddC4) == 10050
getPVobs(50) == ([[50,0]], [[50,0]])
getDeposits(0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2, 0xd9145CCE52D386f254917e481eB44e9943F39138) == 0
getDeposits(0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2, 0xd8b934580fcE35a11B58C6D73aDeE468a2833fa8) == 0
getDeposits(0x5B38Da6a701c568545dCfcB03FcB875f56beddC4, 0xd9145CCE52D386f254917e481eB44e9943F39138) == 0
getDeposits(0x5B38Da6a701c568545dCfcB03FcB875f56beddC4, 0xd8b934580fcE35a11B58C6D73aDeE468a2833fa8) == 0
getAllBuyOrders(50) == ([])
getAllSellOrders(50) == ([])
orderBook(0xd9145CCE52D386f254917e481eB44e9943F39138, 50) == len=0, head=0, tail=<bytes32>
orderBook(0xd8b934580fcE35a11B58C6D73aDeE468a2833fa8, 50) == len=0, head=0, tail=0
activeBuyOrders() == ([]) from buyer
activeSellOrders() == ([]) from buyer
activeBuyOrders() == ([]) from seller
activeSellOrders() == ([]) from seller // ! still exist