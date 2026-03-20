function bookMachine(){
    const machine = document.getElementById("machine").value;
    const time = document.getElementById("time").value;

    if(!machine || !time){
        alert("Please select machine and time");
        return;
    }
    const booking = {
        machine,
        time,
        startTime: new Date().getTime()
    };
    let bookings = JSON.parse(localStorage.getItem("bookings")) || [];
    bookings.push(booking);
    localStorage.setItem("bookings",JSON.stringify(bookings));
    alert("Booking successful!");
    scheduleNotifications(booking);
};
function scheduleNotifications(booking){
    const now = new Date().getTime();
    const start = booking.startTime;

    setTimeout(()=>{
        alert("Reminder: Your laundry session is starting!");
    },60000);    

    setTimeout(()=>{
        alert("Your Laundry is done!");
    },1800000);
};
