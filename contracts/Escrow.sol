//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/utils/Address.sol";

interface IERC721 {
    function transferFrom(
        address _from,
        address _to,
        uint256 _id
    ) external;
}

contract Escrow {
    address public lender;
    address public inspector;
    address payable public seller;
    address public nftAddress;

    modifier onlySeller() {
        require(msg.sender == seller, "Only seller can call this function");
        _;
    }

    modifier onlyBuyer(uint256 _nftId) {
        require(msg.sender == buyer[_nftId], "Only buyer can call this function");
        _;
    }

    modifier onlyInspector() {
        require(msg.sender == inspector, "Only inspector can call this function");
        _;
    }

    mapping(uint256 => bool) public isListed;
    mapping(uint256 => uint256) public purchasePrice;
    mapping (uint256 => uint256) public escrowAmount;
    mapping (uint256 => address) public buyer;
    mapping (uint256 => bool) public isInspected;
    mapping (uint256 => mapping (address=> bool)) public approval;
    // Track earnest deposits per listing to avoid mixing balances across listings
    mapping (uint256 => uint256) public earnestDeposits;

    // Emitted when a sale is cancelled
    event Cancelled(uint256 indexed nftId, address indexed caller, uint256 refundToBuyer, uint256 payoutToSeller);

    constructor(
        address _nftAddress,
        address payable _seller,
        address _inspector,
        address _lender
    ) {
        lender = _lender;
        inspector = _inspector;
        seller = _seller;
        nftAddress = _nftAddress;
    }

    function list(uint256 _nftId, address _buyer,uint256 _price, uint256 _escrowAmount) public payable onlySeller {
       IERC721(nftAddress).transferFrom(msg.sender, address(this), _nftId);
       isListed[_nftId] = true;
       purchasePrice[_nftId] = _price;
       escrowAmount[_nftId] = _escrowAmount;
       buyer[_nftId] = _buyer;
    }

    function depositEarnest(uint256 _nftId) public payable onlyBuyer(_nftId) {
        require(isListed[_nftId], "Property is not listed");
        require(msg.value >= escrowAmount[_nftId], "Not enough escrow amount");
        // record earnest deposit for this listing
        earnestDeposits[_nftId] += msg.value;
    }

    function updateInspectProperty(uint256 _nftId, bool _isInspected) public onlyInspector {
        require(isListed[_nftId], "Property is not listed");
        isInspected[_nftId] = _isInspected;
    }

    function approveSale(uint256 _nftId) public {
        approval[_nftId][msg.sender] = true;
    }

  
    function finalizeSale(uint256 _nftId) public {
        require(isInspected[_nftId], "Property is not inspected");
        require(approval[_nftId][buyer[_nftId]], "Buyer not approved");
        require(approval[_nftId][seller], "Seller not approved");
        require(approval[_nftId][lender], "Lender not approved");
        require(address(this).balance >= purchasePrice[_nftId], "Not enough balance");

        // effects
        isListed[_nftId] = false;

        // interactions
        Address.sendValue(payable(seller), address(this).balance);
        IERC721(nftAddress).transferFrom(address(this), buyer[_nftId], _nftId);
    }

    function cancelSale(uint256 _nftId) public {
        require(isListed[_nftId], "Property is not listed");

        uint256 refundToBuyer = 0;
        uint256 payoutToSeller = 0;

        // effects first
        isListed[_nftId] = false;

        if (!isInspected[_nftId]) {
            // Pre-inspection: only buyer can cancel, refund only the earnest they deposited
            require(msg.sender == buyer[_nftId], "Only buyer can cancel before inspection");
            refundToBuyer = earnestDeposits[_nftId];
            require(refundToBuyer > 0, "No earnest to refund");
            earnestDeposits[_nftId] = 0;
            // interactions
            Address.sendValue(payable(buyer[_nftId]), refundToBuyer);
        } else {
            // Post-inspection: only seller can cancel, seller receives contract balance as compensation
            require(msg.sender == seller, "Only seller can cancel after inspection");
            payoutToSeller = address(this).balance;
            // interactions
            Address.sendValue(payable(seller), payoutToSeller);
        }

        // return NFT and emit event
        IERC721(nftAddress).transferFrom(address(this), seller, _nftId);
        emit Cancelled(_nftId, msg.sender, refundToBuyer, payoutToSeller);
    }

    receive() external payable {}

    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }
}

