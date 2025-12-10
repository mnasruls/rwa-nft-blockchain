const { expect } = require('chai');
const { ethers } = require('hardhat');

const tokens = (n) => {
    return ethers.utils.parseUnits(n.toString(), 'ether')
}

describe('Escrow', () => {

    let buyer, seller, inspector, lender
    let realEstate, escrow

    beforeEach(async () => {
        // Get accounts
        [buyer, seller, inspector, lender] = await ethers.getSigners()

        // Deploy Real Estate
        const RealEstate = await ethers.getContractFactory('RealEstate')
        realEstate = await RealEstate.deploy()

        // Mint and approve real estate
        const tokenURI = 'https://ipfs.io/ipfs/QmQUozrHLAusXDxrvsESJ3PYB3rUeUuBAvVWw6nop2uu7c/1.png'
        let tx = await realEstate.connect(seller).mint(tokenURI)
        await tx.wait()


        // Deploy Escrow
        const Escrow = await ethers.getContractFactory('Escrow')
        escrow = await Escrow.deploy(
            realEstate.address,
            seller.address,
            inspector.address,
            lender.address
        )

        // Approve property transfer
        tx = await realEstate.connect(seller).approve(escrow.address, 1)
        await tx.wait()

        // List property
        let list = await escrow.connect(seller).list(1, buyer.address, tokens(10), tokens(5))
        await list.wait()
    })

    describe('Deployment', () => {
        it('Returns NFT Address', async () => {
          let nftAddress = await escrow.nftAddress()
          expect(nftAddress).to.be.equal(realEstate.address)
        })
        it('Returns Seller Address', async () => {
          let sellerAddress = await escrow.seller()
          expect(sellerAddress).to.be.equal(seller.address)
        })
        it('Returns Inspector Address', async () => {
          let inspectorAddress = await escrow.inspector()
          expect(inspectorAddress).to.be.equal(inspector.address)
        })
        it('Returns Lender Address', async () => {
          let lenderAddress = await escrow.lender()
          expect(lenderAddress).to.be.equal(lender.address)
        })
    })

    describe('Listing', () => {
        it('Update as listed', async () => {
            let isListed = await escrow.isListed(1)
            expect(isListed).to.be.equal(true)
        })
        it('Update ownership to Escrow contract', async () => {
            let owner = await realEstate.ownerOf(1)
            expect(owner).to.be.equal(escrow.address)
        })
        it('Returns buyer address', async () => {
            let buyerAddress = await escrow.buyer(1)
            expect(buyerAddress).to.be.equal(buyer.address)
        })
        it('Returns purchase price', async () => {
            let purchasePrice = await escrow.purchasePrice(1)
            expect(purchasePrice).to.be.equal(tokens(10))
        })
        it('Returns escrow amount', async () => {
            let escrowAmount = await escrow.escrowAmount(1)
            expect(escrowAmount).to.be.equal(tokens(5))
        })
    })

    describe('Depositing', () => {
        it('Updates escrow balance', async () => {
            let tx = await escrow.connect(buyer).depositEarnest(1, { value: tokens(5) })
            await tx.wait()

            let balance = await escrow.getBalance()
            expect(balance).to.be.equal(tokens(5))
        })
    })

    describe('Inspection', () => {
        it('Updates inspection status', async () => {
            let tx = await escrow.connect(inspector).updateInspectProperty(1, true)
            await tx.wait()

            let isInspected = await escrow.isInspected(1)
            expect(isInspected).to.be.equal(true)
        })
    })

    describe('Approval', () => {
        it('Updates approval status', async () => {
            let tx = await escrow.connect(buyer).approveSale(1)
            await tx.wait()

            tx = await escrow.connect(seller).approveSale(1)
            await tx.wait()

            tx = await escrow.connect(lender).approveSale(1)
            await tx.wait()

            expect(await escrow.approval(1, buyer.address)).to.be.equal(true)
            expect(await escrow.approval(1, seller.address)).to.be.equal(true)
            expect(await escrow.approval(1, lender.address)).to.be.equal(true)
        })
    })

    describe('Finalizing', () => {
        beforeEach('Transfers ownership to buyer', async () => {
            let tx = await escrow.connect(buyer).depositEarnest(1, { value: tokens(5) })
            await tx.wait()

            tx = await escrow.connect(inspector).updateInspectProperty(1, true)
            await tx.wait()

            tx = await escrow.connect(buyer).approveSale(1)
            await tx.wait()

            tx = await escrow.connect(seller).approveSale(1)
            await tx.wait()

            tx = await escrow.connect(lender).approveSale(1)
            await tx.wait()

            await lender.sendTransaction({
                to: escrow.address,
                value: tokens(5)
            })

            tx = await escrow.connect(seller).finalizeSale(1)
            await tx.wait()
        })

        it('Updates ownership to buyer', async () => {
            let owner = await realEstate.ownerOf(1)
            expect(owner).to.be.equal(buyer.address)
        })

        it('Updates escrow balance to 0', async () => {
            let balance = await escrow.getBalance()
            expect(balance).to.be.equal(0)
        })
    })
})
